#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_FIXTURES_PATH = 'docs/agent-hardening/continuity-fixtures.json';
const DEFAULT_OUTPUT_PATH = 'docs/generated/continuity-evals-report.json';

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

function normalizeDelta(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const evidence = source.evidence && typeof source.evidence === 'object' ? source.evidence : {};
  const reasoning = source.reasoning && typeof source.reasoning === 'object' ? source.reasoning : {};
  return {
    completedWork: Array.isArray(source.completedWork) ? source.completedWork : [],
    acceptedFacts: Array.isArray(source.acceptedFacts) ? source.acceptedFacts : [],
    decisions: Array.isArray(source.decisions) ? source.decisions : [],
    recentResults: Array.isArray(source.recentResults) ? source.recentResults : [],
    artifacts: Array.isArray(source.artifacts) ? source.artifacts : [],
    blockers: Array.isArray(reasoning.blockers) ? reasoning.blockers : [],
    validationRefs: Array.isArray(evidence.validationRefs) ? evidence.validationRefs : []
  };
}

function includesAll(needles, haystack) {
  const lowered = haystack.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
  if (needles.length === 0) {
    return 1;
  }
  let hits = 0;
  for (const needle of needles) {
    const probe = String(needle).trim().toLowerCase();
    if (probe && lowered.some((entry) => entry.includes(probe) || probe.includes(entry))) {
      hits += 1;
    }
  }
  return hits / needles.length;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scoreScenario(scenario) {
  const output = scenario.resumeOutput && typeof scenario.resumeOutput === 'object' ? scenario.resumeOutput : {};
  const delta = normalizeDelta(output.stateDelta);
  const expected = scenario.requiredContext && typeof scenario.requiredContext === 'object' ? scenario.requiredContext : {};
  const contextCarryover = round(
    (
      includesAll(expected.facts ?? [], delta.acceptedFacts) +
      includesAll(expected.decisions ?? [], delta.decisions) +
      includesAll(expected.artifacts ?? [], [...delta.artifacts, ...delta.validationRefs])
    ) / 3,
    4
  );
  const correctness = round(
    output.status === scenario.expectedStatus && String(output.currentSubtask ?? '').trim() && String(output.nextAction ?? '').trim()
      ? 1
      : 0,
    4
  );
  const duplicateWork = round(
    (Array.isArray(scenario.alreadyCompletedWork) && scenario.alreadyCompletedWork.length > 0)
      ? 1 - includesAll(scenario.alreadyCompletedWork, delta.completedWork)
      : 1,
    4
  );
  const handoffQuality = round(
    (
      (String(output.currentSubtask ?? '').trim() ? 1 : 0) +
      (String(output.nextAction ?? '').trim() ? 1 : 0) +
      ((delta.artifacts.length + delta.validationRefs.length + delta.blockers.length) > 0 ? 1 : 0)
    ) / 3,
    4
  );
  const overall = round(
    correctness * 0.4 +
    contextCarryover * 0.3 +
    duplicateWork * 0.2 +
    handoffQuality * 0.1,
    4
  );
  const passed = overall >= 0.85 && correctness >= 0.7 && contextCarryover >= 0.7;
  return {
    id: scenario.id,
    suite: scenario.suite ?? 'continuity-fixture-resume',
    status: passed ? 'pass' : 'fail',
    score: overall,
    dimensions: {
      correctness,
      contextCarryover,
      duplicateWorkAvoidance: duplicateWork,
      handoffQuality
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const fixturesPath = path.join(rootDir, String(options.fixtures ?? DEFAULT_FIXTURES_PATH));
  const outputPath = path.join(rootDir, String(options.output ?? DEFAULT_OUTPUT_PATH));

  const fixtures = JSON.parse(await fs.readFile(fixturesPath, 'utf8'));
  const scenarios = Array.isArray(fixtures.scenarios) ? fixtures.scenarios : [];
  const results = scenarios.map(scoreScenario);
  const passed = results.filter((entry) => entry.status === 'pass').length;
  const failed = results.filter((entry) => entry.status === 'fail').length;
  const suites = new Map();
  for (const result of results) {
    const current = suites.get(result.suite) ?? { id: result.suite, total: 0, passed: 0, failed: 0, skipped: 0 };
    current.total += 1;
    if (result.status === 'pass') current.passed += 1;
    if (result.status === 'fail') current.failed += 1;
    suites.set(result.suite, current);
  }
  const dogfoodEnabled = String(process.env.ORCH_EXECUTOR_PROVIDER ?? '').trim().length > 0;
  suites.set('continuity-dogfood', {
    id: 'continuity-dogfood',
    total: dogfoodEnabled ? 1 : 0,
    passed: 0,
    failed: 0,
    skipped: dogfoodEnabled ? 0 : 1
  });

  const renderedSuites = [...suites.values()].map((entry) => ({
    id: entry.id,
    status: entry.failed > 0 ? 'fail' : entry.total > 0 ? 'pass' : 'skip',
    total: entry.total,
    passed: entry.passed,
    failed: entry.failed,
    skipped: entry.skipped
  }));

  const report = {
    generatedAtUtc: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      skipped: dogfoodEnabled ? 0 : 1,
      passRate: results.length > 0 ? round(passed / results.length, 4) : null
    },
    suites: renderedSuites,
    scenarios: results,
    evidence: [
      'docs/agent-hardening/continuity-fixtures.json'
    ]
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[continuity-evals] wrote ${path.relative(rootDir, outputPath)} (${passed}/${results.length} passed).`);
}

main().catch((error) => {
  console.error('[continuity-evals] failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
