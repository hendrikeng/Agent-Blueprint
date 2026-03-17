#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const findings = [];
const requiredScripts = new Set([
  'context:compile',
  'docs:verify',
  'harness:verify',
  'plans:verify',
  'verify:fast',
  'verify:full',
  'automation:run',
  'automation:resume',
  'automation:grind',
  'automation:audit'
]);
const retiredScripts = [
  'automation:run:medium',
  'automation:run:high',
  'automation:run:parallel',
  'automation:resume:parallel',
  'automation:resume:high:non-atomic',
  'plans:compile',
  'plans:migrate',
  'plans:scaffold-children',
  'state:verify'
];

function addFinding(code, message, filePath) {
  findings.push({ code, message, filePath });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const packageScriptsPath = path.join(rootDir, 'package.scripts.fragment.json');
  const configPath = path.join(rootDir, 'docs', 'ops', 'automation', 'orchestrator.config.json');
  const policyPath = path.join(rootDir, 'docs', 'governance', 'policy-manifest.json');
  const packageScripts = await readJson(packageScriptsPath);
  const config = await readJson(configPath);
  const policy = await readJson(policyPath);
  const scripts = packageScripts?.scripts ?? {};

  for (const scriptName of requiredScripts) {
    if (!String(scripts[scriptName] ?? '').trim()) {
      addFinding('MISSING_SCRIPT', `Missing required script '${scriptName}'.`, 'package.scripts.fragment.json');
    }
  }
  for (const scriptName of retiredScripts) {
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      addFinding('RETIRED_SCRIPT', `Retired script '${scriptName}' should not exist.`, 'package.scripts.fragment.json');
    }
  }

  const roleNames = Object.keys(config?.executor?.roles ?? {}).sort();
  if (roleNames.join(',') !== 'reviewer,worker') {
    addFinding(
      'INVALID_EXECUTION_ROLES',
      `executor.roles must contain only worker and reviewer (found: ${roleNames.join(', ') || 'none'}).`,
      'docs/ops/automation/orchestrator.config.json'
    );
  }

  const reviewRequired = Array.isArray(config?.risk?.reviewRequired) ? [...config.risk.reviewRequired].sort() : [];
  if (reviewRequired.join(',') !== 'high,medium') {
    addFinding(
      'INVALID_REVIEW_POLICY',
      `risk.reviewRequired must be ['medium', 'high'] (found: ${reviewRequired.join(', ') || 'none'}).`,
      'docs/ops/automation/orchestrator.config.json'
    );
  }

  const securityApprovalRequired = Array.isArray(config?.risk?.securityApprovalRequired)
    ? [...config.risk.securityApprovalRequired].sort()
    : [];
  if (securityApprovalRequired.join(',') !== 'high') {
    addFinding(
      'INVALID_SECURITY_APPROVAL_POLICY',
      `risk.securityApprovalRequired must be ['high'] (found: ${securityApprovalRequired.join(', ') || 'none'}).`,
      'docs/ops/automation/orchestrator.config.json'
    );
  }

  if (!Array.isArray(config?.validation?.always) || config.validation.always.length === 0) {
    addFinding('MISSING_ALWAYS_VALIDATION', 'validation.always must contain at least one command.', 'docs/ops/automation/orchestrator.config.json');
  }
  if (!Array.isArray(config?.validation?.hostRequired) || config.validation.hostRequired.length === 0) {
    addFinding(
      'MISSING_HOST_VALIDATION',
      'validation.hostRequired must contain at least one command.',
      'docs/ops/automation/orchestrator.config.json'
    );
  }

  const minRemaining = Number(config?.executor?.contextBudget?.minRemaining);
  if (!Number.isFinite(minRemaining) || minRemaining < 0) {
    addFinding(
      'INVALID_CONTEXT_BUDGET_TOKENS',
      'executor.contextBudget.minRemaining must be a non-negative number.',
      'docs/ops/automation/orchestrator.config.json'
    );
  }

  const minRemainingPercent = Number(config?.executor?.contextBudget?.minRemainingPercent);
  if (!Number.isFinite(minRemainingPercent) || minRemainingPercent < 0 || minRemainingPercent > 1) {
    addFinding(
      'INVALID_CONTEXT_BUDGET_PERCENT',
      'executor.contextBudget.minRemainingPercent must be between 0 and 1.',
      'docs/ops/automation/orchestrator.config.json'
    );
  }

  const roleContracts = Object.keys(policy?.roleContracts ?? {});
  for (const roleName of ['planner', 'explorer', 'worker', 'reviewer']) {
    if (!roleContracts.includes(roleName)) {
      addFinding(
        'MISSING_ROLE_CONTRACT',
        `policy-manifest.json must describe role '${roleName}'.`,
        'docs/governance/policy-manifest.json'
      );
    }
  }
  if ((policy?.memoryPosture?.whatToDo ?? []).some((entry) => String(entry).includes('contact pack'))) {
    addFinding(
      'STALE_MEMORY_POSTURE',
      'policy-manifest.json should not describe contact packs in the flat queue harness.',
      'docs/governance/policy-manifest.json'
    );
  }

  if (findings.length > 0) {
    console.error(`[harness:verify] failed with ${findings.length} issue(s).`);
    for (const finding of findings) {
      console.error(`- [${finding.code}] ${finding.message} (${finding.filePath})`);
    }
    process.exit(1);
  }

  console.log('[harness:verify] ok.');
}

main().catch((error) => {
  console.error('[harness:verify] failed with an unexpected error.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
