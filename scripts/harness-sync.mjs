#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourceManifestPath = path.join(rootDir, 'distribution', 'harness-ownership-manifest.json');
const defaultDownstreamManifestRel = path.join('docs', 'ops', 'automation', 'harness-manifest.json');

function parseArgs(argv) {
  const [command = '', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function asBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function usage() {
  process.stderr.write(
    'Usage: node ./scripts/harness-sync.mjs <install|update|drift> --target <path> [--json true|false]\n'
  );
}

function toPosix(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function walkFiles(baseDir, currentDir = baseDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(baseDir, absPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    files.push(absPath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function normalizePattern(value) {
  return toPosix(String(value ?? '').trim()).replace(/^\.?\//, '');
}

function matchesExcludePattern(relativePath, pattern) {
  const normalizedPath = normalizePattern(relativePath);
  const normalizedPattern = normalizePattern(pattern);
  if (!normalizedPattern) {
    return false;
  }
  if (normalizedPattern.startsWith('**/')) {
    const suffix = normalizedPattern.slice(3);
    return normalizedPath === suffix || normalizedPath.endsWith(`/${suffix}`);
  }
  return normalizedPath === normalizedPattern || normalizedPath.endsWith(`/${normalizedPattern}`);
}

function isExcluded(relativePath, manifest) {
  const patterns = Array.isArray(manifest?.excludeGlobs) ? manifest.excludeGlobs : [];
  return patterns.some((pattern) => matchesExcludePattern(relativePath, pattern));
}

async function sha256(filePath) {
  const buffer = await fs.readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

function gitHeadRevision() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'ignore']
  });
  if (result.status !== 0) {
    return null;
  }
  const value = String(result.stdout ?? '').trim();
  return value || null;
}

async function collectSourceFiles(manifest) {
  const sourceRoot = path.join(rootDir, manifest.sourceRoot);
  const targetRoot = String(manifest.targetRoot ?? '.').trim() || '.';
  const files = await walkFiles(sourceRoot);
  const entries = [];
  for (const absPath of files) {
    const relFromSource = toPosix(path.relative(sourceRoot, absPath));
    if (isExcluded(relFromSource, manifest)) {
      continue;
    }
    const stat = await fs.stat(absPath);
    entries.push({
      sourcePath: toPosix(path.relative(rootDir, absPath)),
      targetPath: toPosix(path.join(targetRoot, relFromSource)),
      sha256: await sha256(absPath),
      size: stat.size
    });
  }
  return entries;
}

function downstreamManifestRel(manifest) {
  return String(manifest?.downstreamManifestPath ?? defaultDownstreamManifestRel).trim() || defaultDownstreamManifestRel;
}

async function readDownstreamManifest(targetDir, manifest) {
  try {
    return await readJson(path.join(targetDir, downstreamManifestRel(manifest)));
  } catch {
    return null;
  }
}

async function compareTarget(targetDir, sourceEntries, installedManifest = null) {
  const missing = [];
  const modified = [];
  const managedSet = new Set();

  for (const entry of sourceEntries) {
    managedSet.add(entry.targetPath);
    const targetPath = path.join(targetDir, entry.targetPath);
    try {
      const targetHash = await sha256(targetPath);
      if (targetHash !== entry.sha256) {
        modified.push(entry.targetPath);
      }
    } catch {
      missing.push(entry.targetPath);
    }
  }

  const unexpectedManaged = [];
  for (const entry of installedManifest?.managedFiles ?? []) {
    const targetPath = String(entry?.targetPath ?? '').trim();
    if (!targetPath || managedSet.has(targetPath)) {
      continue;
    }
    unexpectedManaged.push(targetPath);
  }

  return {
    missing: missing.sort((left, right) => left.localeCompare(right)),
    modified: modified.sort((left, right) => left.localeCompare(right)),
    unexpectedManaged: unexpectedManaged.sort((left, right) => left.localeCompare(right))
  };
}

async function writeDownstreamManifest(targetDir, manifest, sourceEntries) {
  const downstreamManifestPath = path.join(targetDir, downstreamManifestRel(manifest));
  const payload = {
    schemaVersion: 1,
    ownershipMode: manifest.ownershipMode,
    sourceManifest: toPosix(path.relative(targetDir, sourceManifestPath)),
    sourceRevision: gitHeadRevision(),
    installedAt: new Date().toISOString(),
    managedFiles: sourceEntries
  };
  await fs.mkdir(path.dirname(downstreamManifestPath), { recursive: true });
  await fs.writeFile(downstreamManifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function installOrUpdate(targetDir, manifest, sourceEntries) {
  const copied = [];
  for (const entry of sourceEntries) {
    const sourcePath = path.join(rootDir, entry.sourcePath);
    const targetPath = path.join(targetDir, entry.targetPath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
    copied.push(entry.targetPath);
  }
  await writeDownstreamManifest(targetDir, manifest, sourceEntries);
  return copied;
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!['install', 'update', 'drift'].includes(command)) {
    usage();
    process.exit(1);
  }

  const targetDirRaw = String(options.target ?? '').trim();
  if (!targetDirRaw) {
    usage();
    process.exit(1);
  }

  const targetDir = path.resolve(targetDirRaw);
  const jsonOutput = asBoolean(options.json, false);
  const sourceManifest = await readJson(sourceManifestPath);
  const sourceEntries = await collectSourceFiles(sourceManifest);
  const installedManifest = await readDownstreamManifest(targetDir, sourceManifest);
  const drift = await compareTarget(targetDir, sourceEntries, installedManifest);

  if (command === 'drift') {
    const payload = {
      command,
      target: targetDir,
      missing: drift.missing,
      modified: drift.modified,
      unexpectedManaged: drift.unexpectedManaged,
      driftDetected: drift.missing.length > 0 || drift.modified.length > 0 || drift.unexpectedManaged.length > 0
    };
    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`[harness-sync] target=${payload.target}\n`);
      process.stdout.write(`[harness-sync] missing=${payload.missing.length} modified=${payload.modified.length} unexpectedManaged=${payload.unexpectedManaged.length}\n`);
    }
    process.exit(payload.driftDetected ? 2 : 0);
  }

  await fs.mkdir(targetDir, { recursive: true });
  const copied = await installOrUpdate(targetDir, sourceManifest, sourceEntries);
  const payload = {
    command,
    target: targetDir,
    filesCopied: copied.length,
    manifestPath: toPosix(path.join(targetDir, downstreamManifestRel(sourceManifest)))
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`[harness-sync] ${command} target=${payload.target} filesCopied=${payload.filesCopied}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`[harness-sync] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
