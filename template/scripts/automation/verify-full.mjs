#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolveRepoOrAbsolutePath, writeTextFileAtomic } from './lib/orchestrator-shared.mjs';
import { CONTRACT_IDS, prepareContractPayload } from './lib/contracts/index.mjs';

const rootDir = process.cwd();
const aggregateResultPath = String(process.env.ORCH_VALIDATION_RESULT_PATH ?? '').trim();

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

function runCommand(command, dryRun) {
  if (dryRun) {
    console.log(`[verify-full] dry-run: ${command}`);
    return { status: 0 };
  }
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  return { status: result.status ?? 1 };
}

async function writeValidationResult(payload) {
  if (!aggregateResultPath) {
    return;
  }
  const absPath = resolveRepoOrAbsolutePath(rootDir, aggregateResultPath)?.abs;
  if (!absPath) {
    return;
  }
  const normalized = prepareContractPayload(CONTRACT_IDS.validationResult, {
    ...payload,
    command: String(payload?.command ?? 'npm run verify:full').trim(),
    lane: 'host-required'
  });
  await writeTextFileAtomic(absPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dryRun = asBoolean(options['dry-run'], false);
  const commands = [
    'node ./scripts/automation/verify-fast.mjs',
    'node ./scripts/check-article-conformance.mjs',
    'node ./scripts/architecture/check-dependencies.mjs',
    'node ./scripts/agent-hardening/check-agent-hardening.mjs',
    'node ./scripts/agent-hardening/check-evals.mjs'
  ];

  console.log(`[verify-full] running ${commands.length} command(s).`);
  for (const command of commands) {
    const execution = runCommand(command, dryRun);
    if (execution.status !== 0) {
      await writeValidationResult({
        validationId: process.env.ORCH_VALIDATION_ID || 'repo:verify-full',
        type: process.env.ORCH_VALIDATION_TYPE || 'host-required',
        status: 'failed',
        summary: `[verify-full] failed: ${command}`,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        findingFiles: [],
        evidenceRefs: [],
        artifactRefs: []
      });
      process.exit(execution.status);
    }
  }

  await writeValidationResult({
    validationId: process.env.ORCH_VALIDATION_ID || 'repo:verify-full',
    type: process.env.ORCH_VALIDATION_TYPE || 'host-required',
    status: 'passed',
    summary: '[verify-full] passed.',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    findingFiles: [],
    evidenceRefs: [],
    artifactRefs: []
  });
  console.log('[verify-full] passed.');
}

main().catch((error) => {
  writeValidationResult({
    validationId: process.env.ORCH_VALIDATION_ID || 'repo:verify-full',
    type: process.env.ORCH_VALIDATION_TYPE || 'host-required',
    status: 'failed',
    summary: error instanceof Error ? error.message : String(error),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    findingFiles: [],
    evidenceRefs: [],
    artifactRefs: []
  }).finally(() => {
    console.error('[verify-full] failed with an unexpected error.');
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
});
