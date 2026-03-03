#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const commandArg = String(process.argv[2] ?? 'run').trim().toLowerCase();
const firstCommand = commandArg === 'resume' ? 'resume' : 'run';
const passthroughArgs = process.argv.slice(3);

const maxCycles = Number.parseInt(process.env.ORCH_GRIND_MAX_CYCLES ?? '120', 10);
const stableLimit = Number.parseInt(process.env.ORCH_GRIND_STABLE_LIMIT ?? '4', 10);
const rootDir = process.cwd();
const runStatePath = path.join(rootDir, 'docs/ops/automation/run-state.json');

const baseArgs = [
  '--mode', 'guarded',
  '--retry-failed', 'true',
  '--auto-unblock', 'true',
  '--max-failed-retries', '2',
  '--output', process.env.ORCH_OUTPUT ?? 'pretty'
];

let stableCycles = 0;
let previousSignature = '';

function runOrchestrator(command) {
  const args = ['./scripts/automation/orchestrator.mjs', command, ...baseArgs, ...passthroughArgs];
  const renderedArgs = [command, ...baseArgs, ...passthroughArgs].join(' ');
  console.log(`[grind] starting: node ./scripts/automation/orchestrator.mjs ${renderedArgs}`);
  const result = spawnSync('node', args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readRunState() {
  if (!existsSync(runStatePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(runStatePath, 'utf8'));
  } catch (error) {
    console.error(`[grind] failed to parse ${runStatePath}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function stateSignature(state) {
  const queue = Array.isArray(state?.queue) ? state.queue : [];
  const blocked = Array.isArray(state?.blockedPlanIds) ? state.blockedPlanIds : [];
  const failed = Array.isArray(state?.failedPlanIds) ? state.failedPlanIds : [];
  const completedCount = Array.isArray(state?.completedPlanIds) ? state.completedPlanIds.length : 0;
  const inProgressPlan = state?.inProgress?.planId ?? null;
  return JSON.stringify({ queue, blocked, failed, completedCount, inProgressPlan });
}

function queueDrained(state) {
  const queue = Array.isArray(state?.queue) ? state.queue : [];
  return queue.length === 0 && !state?.inProgress;
}

function renderSummary(state) {
  const queueCount = Array.isArray(state?.queue) ? state.queue.length : 0;
  const blockedCount = Array.isArray(state?.blockedPlanIds) ? state.blockedPlanIds.length : 0;
  const failedCount = Array.isArray(state?.failedPlanIds) ? state.failedPlanIds.length : 0;
  const inProgressPlan = state?.inProgress?.planId ?? 'none';
  return `queue=${queueCount} blocked=${blockedCount} failed=${failedCount} inProgress=${inProgressPlan}`;
}

for (let cycle = 0; cycle < maxCycles; cycle += 1) {
  const command = cycle === 0 ? firstCommand : 'resume';
  runOrchestrator(command);

  const state = readRunState();
  if (!state) {
    console.log('[grind] run-state not found; stopping.');
    process.exit(0);
  }

  console.log(`[grind] state after cycle ${cycle + 1}: ${renderSummary(state)}`);

  if (queueDrained(state)) {
    console.log('[grind] queue drained; done.');
    process.exit(0);
  }

  const signature = stateSignature(state);
  if (signature === previousSignature) {
    stableCycles += 1;
  } else {
    stableCycles = 0;
  }
  previousSignature = signature;

  if (stableCycles >= stableLimit) {
    console.error(
      `[grind] no queue progress for ${stableCycles + 1} consecutive cycles. ` +
      'Stopping for manual review to avoid endless retries.'
    );
    process.exit(2);
  }
}

console.error(`[grind] reached ORCH_GRIND_MAX_CYCLES=${maxCycles}. Stopping.`);
process.exit(2);
