#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  inferPlanId,
  listMarkdownFiles,
  metadataValue,
  parseListField,
  parseMetadata
} from './lib/plan-metadata.mjs';

const rootDir = process.cwd();
const directories = {
  future: path.join(rootDir, 'docs', 'future'),
  active: path.join(rootDir, 'docs', 'exec-plans', 'active'),
  completed: path.join(rootDir, 'docs', 'exec-plans', 'completed')
};

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

function normalizePathValue(value) {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.?\//, '');
}

function tokenize(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 4)
  );
}

function intersectCount(left, right) {
  let count = 0;
  for (const item of left) {
    if (right.has(item)) {
      count += 1;
    }
  }
  return count;
}

async function loadPlan(filePath, phase) {
  const content = await fs.readFile(filePath, 'utf8');
  const metadata = parseMetadata(content);
  const rel = path.relative(rootDir, filePath).split(path.sep).join('/');
  const planId = inferPlanId(content, filePath) ?? path.basename(filePath, '.md');
  const specTargets = parseListField(metadataValue(metadata, 'Spec-Targets')).map(normalizePathValue);
  const tags = parseListField(metadataValue(metadata, 'Tags')).map((value) => value.toLowerCase());
  const tokenSet = new Set([
    ...tokenize(planId),
    ...tokenize(path.basename(filePath, '.md')),
    ...tags.flatMap((tag) => [...tokenize(tag)]),
    ...specTargets.flatMap((target) => [...tokenize(target)])
  ]);
  return {
    phase,
    filePath,
    rel,
    planId,
    specTargets,
    tags,
    tokenSet
  };
}

function scoreOverlap(plan, completedPlan) {
  let score = 0;
  const reasons = [];

  const sharedTargets = plan.specTargets.filter((target) => completedPlan.specTargets.includes(target));
  if (sharedTargets.length > 0) {
    score += sharedTargets.length * 4;
    reasons.push(`shared-targets:${sharedTargets.slice(0, 3).join(', ')}`);
  }

  const sharedTags = plan.tags.filter((tag) => completedPlan.tags.includes(tag));
  if (sharedTags.length > 0) {
    score += sharedTags.length * 3;
    reasons.push(`shared-tags:${sharedTags.slice(0, 3).join(', ')}`);
  }

  const sharedTokens = intersectCount(plan.tokenSet, completedPlan.tokenSet);
  if (sharedTokens > 0) {
    score += Math.min(sharedTokens, 6);
    reasons.push(`shared-keywords:${sharedTokens}`);
  }

  if (completedPlan.planId.includes(plan.planId) || plan.planId.includes(completedPlan.planId)) {
    score += 5;
    reasons.push('plan-id-overlap');
  }

  return { score, reasons };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requestedFile = String(options['plan-file'] ?? '').trim();
  if (!requestedFile) {
    throw new Error('Usage: node ./scripts/automation/suggest-plan-reconciliation.mjs --plan-file <path>');
  }

  const absolutePlanFile = path.isAbsolute(requestedFile)
    ? requestedFile
    : path.join(rootDir, requestedFile);

  let phase = null;
  if (absolutePlanFile.startsWith(directories.future)) {
    phase = 'future';
  } else if (absolutePlanFile.startsWith(directories.active)) {
    phase = 'active';
  } else {
    throw new Error('Plan file must live under docs/future or docs/exec-plans/active.');
  }

  const plan = await loadPlan(absolutePlanFile, phase);
  const completedFiles = await listMarkdownFiles(directories.completed);
  const completedPlans = await Promise.all(completedFiles.map((filePath) => loadPlan(filePath, 'completed')));
  const ranked = completedPlans
    .map((completedPlan) => ({
      completedPlan,
      ...scoreOverlap(plan, completedPlan)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.completedPlan.rel.localeCompare(right.completedPlan.rel))
    .slice(0, 20);

  const output = {
    plan: {
      file: plan.rel,
      planId: plan.planId
    },
    candidates: ranked.map(({ completedPlan, score, reasons }) => ({
      file: completedPlan.rel,
      planId: completedPlan.planId,
      score,
      reasons
    }))
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`suggest-plan-reconciliation: ${message}\n`);
  process.exitCode = 1;
});
