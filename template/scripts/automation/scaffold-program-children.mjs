#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readValidationIdsFromConfig, parseWriteMode } from './lib/program-child-migration.mjs';
import { scaffoldProgramChildDefinitions } from './lib/program-parent-authoring.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function usage() {
  process.stderr.write(
    'Usage: node ./scripts/automation/scaffold-program-children.mjs --plan-file <path> [--write true|false]\n'
  );
}

export function scaffoldProgramChildren(content, options = {}) {
  return scaffoldProgramChildDefinitions(content, {
    validationIds: options.validationIds ?? {
      always: [],
      'host-required': []
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const planFile = String(options['plan-file'] ?? '').trim();
  if (!planFile) {
    usage();
    process.exit(1);
  }

  const rootDir = process.cwd();
  const absPath = path.resolve(planFile);
  const content = await fs.readFile(absPath, 'utf8');
  const validationIds = await readValidationIdsFromConfig(rootDir, fs);
  const scaffold = scaffoldProgramChildren(content, { validationIds });

  if (parseWriteMode(options.write, false)) {
    await fs.writeFile(absPath, scaffold.updatedContent, 'utf8');
    process.stderr.write(
      `[scaffold-program-children] wrote ${path.relative(rootDir, absPath)} with ${scaffold.definitions.length} draft child definition(s).\n`
    );
    return;
  }

  process.stderr.write(
    `[scaffold-program-children] preview generated ${scaffold.definitions.length} draft child definition(s) for ${path.relative(rootDir, absPath)}.\n`
  );
  process.stdout.write(`${scaffold.updatedContent}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`[scaffold-program-children] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
