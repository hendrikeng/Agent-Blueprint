#!/usr/bin/env node
import { compileProgramChildren } from './lib/program-child-compiler.mjs';

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

function asBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const write = asBoolean(options.write, false);
  const dryRun = asBoolean(options['dry-run'] ?? options.dryRun, false);
  const result = await compileProgramChildren(process.cwd(), {
    write,
    dryRun,
    planId: options['plan-id'] ?? options.planId ?? null
  });

  if (result.advisories.length > 0) {
    console.log(`[plans-compile] advisories (${result.advisories.length}).`);
    for (const advisory of result.advisories) {
      console.log(`- [${advisory.code}] ${advisory.message} (${advisory.filePath})`);
    }
  }

  if (result.writes.length > 0 || result.moves.length > 0) {
    console.log(`[plans-compile] writes=${result.writes.length} moves=${result.moves.length}.`);
    for (const entry of result.writes) {
      console.log(`- [${entry.action}] ${entry.planId} -> ${entry.filePath}`);
    }
    for (const entry of result.moves) {
      console.log(`- [moved] ${entry.planId}: ${entry.source} -> ${entry.target}`);
    }
  }

  if (result.issues.length > 0) {
    console.error(`[plans-compile] failed (${result.issues.length} issue(s)).`);
    for (const issue of result.issues) {
      console.error(`- [${issue.code}] ${issue.message} (${issue.filePath})`);
    }
    process.exit(1);
  }

  console.log(`[plans-compile] ok parents=${result.compiledParents.length} write=${write ? 'yes' : 'no'}.`);
}

main().catch((error) => {
  console.error('[plans-compile] failed with an unexpected error.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
