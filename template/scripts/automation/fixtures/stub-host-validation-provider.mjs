#!/usr/bin/env node
import path from 'node:path';

import { nextScenarioStep, writeStructuredResult } from './scenario-driver.mjs';

async function main() {
  const rootDir = process.cwd();
  const planId = String(process.env.ORCH_PLAN_ID ?? '').trim();
  const resultPath = String(process.env.ORCH_HOST_VALIDATION_RESULT_PATH ?? '').trim();
  if (!resultPath) {
    throw new Error('ORCH_HOST_VALIDATION_RESULT_PATH is required for stub host validation provider.');
  }

  const step = await nextScenarioStep(rootDir, 'validation', `host:${planId}`, {
    status: 'passed',
    reason: null,
    evidence: [`host validation passed for ${planId}`],
    results: []
  });
  const payload = {
    status: String(step.status ?? 'passed').trim().toLowerCase(),
    reason: step.reason == null ? null : String(step.reason),
    evidence: Array.isArray(step.evidence) ? step.evidence : [`host validation ${step.status ?? 'passed'} for ${planId}`],
    results: Array.isArray(step.results) ? step.results : [],
    failedResult: step.failedResult ?? null
  };
  await writeStructuredResult(path.join(rootDir, resultPath), payload);

  process.exit(payload.status === 'failed' ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
