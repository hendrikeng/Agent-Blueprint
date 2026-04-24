#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_OUTPUT_PATH = 'docs/generated/AGENT-RUNTIME-CONTEXT.md';
const DEFAULT_POLICY_PATH = 'docs/governance/policy-manifest.json';
const DEFAULT_CONFIG_PATH = 'docs/ops/automation/orchestrator.config.json';

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

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function summarizeList(items, prefix) {
  return (Array.isArray(items) ? items : [])
    .map((entry) => `- ${prefix}${entry}`)
    .join('\n');
}

function summarizeExecutionQuality(executionQuality) {
  if (!executionQuality) {
    return '';
  }

  const sections = [
    ['goal: ', executionQuality.goalDrivenExecution],
    ['scope: ', executionQuality.simplicityAndScope],
    ['assumption: ', executionQuality.assumptionDiscipline],
  ];

  return sections
    .map(([prefix, items]) => summarizeList(items, prefix))
    .filter(Boolean)
    .join('\n');
}

function buildContent(policy, config) {
  const worker = config?.executor?.roles?.worker ?? {};
  const reviewer = config?.executor?.roles?.reviewer ?? {};
  const reviewRequired = Array.isArray(config?.risk?.reviewRequired) ? config.risk.reviewRequired.join(', ') : 'medium, high';
  const securityApprovalRequired = Array.isArray(config?.risk?.securityApprovalRequired)
    ? config.risk.securityApprovalRequired.join(', ')
    : 'high';
  const alwaysValidation = Array.isArray(config?.validation?.always)
    ? config.validation.always.map((entry) => entry.id).join(', ')
    : 'repo:verify-fast';
  const hostValidation = Array.isArray(config?.validation?.hostRequired)
    ? config.validation.hostRequired.map((entry) => entry.id).join(', ')
    : 'repo:verify-full';
  const contextBudgetTokens = Number.isFinite(Number(config?.executor?.contextBudget?.minRemaining))
    ? Number(config.executor.contextBudget.minRemaining)
    : 12000;
  const contextBudgetPercent = Number.isFinite(Number(config?.executor?.contextBudget?.minRemainingPercent))
    ? `${Math.round(Number(config.executor.contextBudget.minRemainingPercent) * 100)}%`
    : '15%';

  return `# Agent Runtime Context (Generated)

Primary Sources: AGENTS.md, docs/governance/policy-manifest.json, docs/ops/automation/orchestrator.config.json

## Mission
- Plan futures by creating or updating executable future slices directly in docs/future/.
- Run a flat queue in sequence: promote ready slices, implement them, review medium/high risk work, validate, and close.
- Keep the repo as the source of truth for plans, evidence, runtime state, and handoffs.

## Hard Safety Rules
${summarizeList(policy?.mandatorySafetyRules?.map((rule) => `[${rule.id}] ${rule.statement}`), '')}

## Planning Roles
- planner: ${policy?.roleContracts?.planner?.intent ?? 'Turn intent into an executable future slice.'}
- explorer: ${policy?.roleContracts?.explorer?.intent ?? 'Investigate risky surfaces before implementation.'}

## Grind Roles
- worker: sandbox=${worker.sandboxMode ?? 'full-access'}, reasoning=${worker.reasoningEffort ?? 'high'}
- reviewer: sandbox=${reviewer.sandboxMode ?? 'read-only'}, reasoning=${reviewer.reasoningEffort ?? 'high'}
- review required for: ${reviewRequired}
- explicit security approval required for: ${securityApprovalRequired}
- low-context handoff threshold: <= ${contextBudgetTokens} remaining tokens or <= ${contextBudgetPercent} remaining context when available

## Verification Profiles
- fast: ${(policy?.validationPolicy?.fastIteration ?? []).join(' ; ')}
- full: ${(policy?.validationPolicy?.fullGate ?? []).join(' ; ')}
- validation lanes: always=${alwaysValidation} ; host-required=${hostValidation}

## Execution Quality
${summarizeExecutionQuality(policy?.executionQuality)}

## Memory Posture
${summarizeList(policy?.memoryPosture?.whatToDo, 'do: ')}
${summarizeList(policy?.memoryPosture?.improveBeforeRearchitecture, 'improve first: ')}
${summarizeList(policy?.memoryPosture?.doNotAddYet, 'not yet: ')}
${summarizeList(policy?.memoryPosture?.escalateWhen, 'escalate when: ')}
- safe rule: ${policy?.memoryPosture?.safeRule ?? 'Keep continuity repo-local unless repeated failures prove otherwise.'}

## Execution Checklist
- Read the current plan and latest checkpoint before editing.
- Translate the request into verifiable goals; for multi-step work, pair each step with its check.
- Honor Implementation-Targets, Validation-Lanes, and Security-Approval exactly as written.
- Write a structured result to ORCH_RESULT_PATH after each worker or reviewer session, or emit a single-line {"type":"orch_result","payload":...} stdout envelope if the sandbox prevents direct writes.
- Move plans to validation only when every must-land item is checked.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const outputPath = path.resolve(rootDir, String(options.output ?? DEFAULT_OUTPUT_PATH));
  const policyPath = path.resolve(rootDir, String(options.policy ?? DEFAULT_POLICY_PATH));
  const configPath = path.resolve(rootDir, String(options.config ?? DEFAULT_CONFIG_PATH));
  const policy = await readJson(policyPath);
  const config = await readJson(configPath);
  const content = buildContent(policy, config);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, 'utf8');
  console.log(`[context:compile] wrote ${path.relative(rootDir, outputPath).split(path.sep).join('/')}`);
}

main().catch((error) => {
  console.error('[context:compile] failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
