#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const TEST_DIRS = [
  path.join(rootDir, 'scripts'),
  path.join(rootDir, 'template', 'scripts')
];

async function collectTests(baseDir) {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTests(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const testFiles = [];
  for (const directory of TEST_DIRS) {
    testFiles.push(...await collectTests(directory));
  }

  const relFiles = [...new Set(testFiles)]
    .map((filePath) => path.relative(rootDir, filePath))
    .sort((left, right) => left.localeCompare(right));

  const result = spawnSync('node', ['--test', ...relFiles], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error('[run-root-tests] failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
