#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function selectAction(scenario, state, planId, isHostValidation) {
  if (!isHostValidation) {
    return {
      status: 'passed',
      reason: null,
      evidence: [`Always validation defaulted to passed for ${planId}.`],
      results: []
    };
  }
  const actionList = scenario?.hostValidationActions?.[planId] ?? [];
  const key = `host:${planId}`;
  const nextIndex = Number.isInteger(state.hostCounters?.[key]) ? state.hostCounters[key] : 0;
  state.hostCounters = state.hostCounters ?? {};
  state.hostCounters[key] = nextIndex + 1;
  if (actionList.length === 0) {
    return {
      status: 'passed',
      reason: null,
      evidence: [`Host validation defaulted to passed for ${planId}.`],
      results: []
    };
  }
  return actionList[Math.min(nextIndex, actionList.length - 1)];
}

async function main() {
  const rootDir = process.cwd();
  const planId = String(process.env.ORCH_PLAN_ID ?? '').trim();
  const hostResultPath = String(process.env.ORCH_HOST_VALIDATION_RESULT_PATH ?? '').trim();
  const resultPath = path.resolve(hostResultPath || process.env.ORCH_VALIDATION_RESULT_PATH || '');
  const isHostValidation = Boolean(hostResultPath);
  const scenarioPath = path.join(rootDir, 'docs', 'ops', 'automation', 'fixture-scenario.json');
  const statePath = path.join(rootDir, 'docs', 'ops', 'automation', 'runtime', 'fixture-provider-state.json');
  const scenario = await readJson(scenarioPath, {});
  const state = await readJson(statePath, {});
  const action = selectAction(scenario, state, planId, isHostValidation);

  await writeJson(statePath, state);
  await writeJson(resultPath, {
    status: action.status,
    reason: action.reason ?? null,
    evidence: action.evidence ?? [],
    results: action.results ?? []
  });

  process.exit(action.status === 'failed' ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`[stub-host-validation] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
