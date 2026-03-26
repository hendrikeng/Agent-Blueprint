import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { runShellMonitored } from './orchestrator.mjs';

const logging = {
  mode: 'minimal',
  heartbeatSeconds: 1,
  stallWarnSeconds: 2
};

test('runShellMonitored keeps extending the timeout while the executor emits progress', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'orch-timeout-progress-'));
  const command = `node --input-type=module -e "for (let step = 0; step < 6; step += 1) { console.log(JSON.stringify({ type: 'progress', activity: 'step-' + step })); await new Promise((resolve) => setTimeout(resolve, 250)); } console.log('done');"`;

  const execution = await runShellMonitored(command, cwd, process.env, 1000, logging, {
    phase: 'session',
    planId: 'timeout-progress',
    role: 'worker',
    activity: 'implementing'
  });

  assert.equal(execution.status, 0);
  assert.equal(execution.error, null);
  assert.match(String(execution.stdout), /done/);
});

test('runShellMonitored still times out when the executor stops making progress', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'orch-timeout-stall-'));
  const command = `node --input-type=module -e "console.log(JSON.stringify({ type: 'progress', activity: 'starting' })); await new Promise((resolve) => setTimeout(resolve, 1500));"`;

  const execution = await runShellMonitored(command, cwd, process.env, 1000, logging, {
    phase: 'session',
    planId: 'timeout-stall',
    role: 'worker',
    activity: 'implementing'
  });

  assert.deepEqual(execution.error, { code: 'ETIMEDOUT' });
  assert.notEqual(execution.status, 0);
});

test('runShellMonitored normalizes timeout exit status when the child exits 0 after SIGTERM', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'orch-timeout-clean-exit-'));
  const command = `node --input-type=module -e "process.on('SIGTERM', () => process.exit(0)); console.log(JSON.stringify({ type: 'progress', activity: 'starting' })); await new Promise((resolve) => setTimeout(resolve, 1500));"`;

  const execution = await runShellMonitored(command, cwd, process.env, 1000, logging, {
    phase: 'session',
    planId: 'timeout-clean-exit',
    role: 'reviewer',
    activity: 'reviewing'
  });

  assert.deepEqual(execution.error, { code: 'ETIMEDOUT' });
  assert.equal(execution.status, 124);
});
