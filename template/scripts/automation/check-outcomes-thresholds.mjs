#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG_PATH = 'docs/ops/automation/orchestrator.config.json';
const DEFAULT_REPORT_PATH = 'docs/generated/run-outcomes.json';

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

function asNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function checkThreshold(findings, label, actual, comparator, expected) {
  if (actual == null) {
    return;
  }
  const ok = comparator === '<=' ? actual <= expected : actual >= expected;
  if (!ok) {
    findings.push(`${label} ${actual} violates ${comparator} ${expected}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const configPath = path.join(rootDir, String(options.config ?? DEFAULT_CONFIG_PATH));
  const reportPath = path.join(rootDir, String(options.report ?? DEFAULT_REPORT_PATH));
  const warnOnly = asBoolean(options['warn-only'], false);

  const [config, report] = await Promise.all([readJson(configPath), readJson(reportPath)]);
  const thresholds = config?.continuity?.thresholds ?? {};
  const memory = report?.summary?.memory ?? {};
  const rework = report?.summary?.rework ?? {};
  const sessions = asNumber(memory.sessions, 0);

  if (sessions <= 0) {
    console.log('[outcomes-verify] skipped (no session sample).');
    return;
  }

  const findings = [];
  checkThreshold(
    findings,
    'derivedContinuityRate',
    asNumber(memory.derivedContinuityRate),
    '<=',
    asNumber(thresholds.maxDerivedContinuityRate, 0.1)
  );
  checkThreshold(
    findings,
    'resumeSafeCheckpointRate',
    asNumber(memory.resumeSafeCheckpointRate),
    '>=',
    asNumber(thresholds.minResumeSafeCheckpointRate, 0.95)
  );
  checkThreshold(
    findings,
    'thinPackRate',
    asNumber(memory.contactPacks?.thinRate),
    '<=',
    asNumber(thresholds.maxThinPackRate, 0.1)
  );
  checkThreshold(
    findings,
    'repeatedHandoffLoopPlans',
    asNumber(rework.repeatedHandoffLoopPlans, 0),
    '<=',
    asNumber(thresholds.maxRepeatedHandoffLoopPlans, 0)
  );

  if (findings.length === 0) {
    console.log('[outcomes-verify] passed.');
    return;
  }

  const prefix = warnOnly ? '[outcomes-verify] warning:' : '[outcomes-verify] failed:';
  for (const finding of findings) {
    console.log(`${prefix} ${finding}`);
  }
  if (!warnOnly) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[outcomes-verify] failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
