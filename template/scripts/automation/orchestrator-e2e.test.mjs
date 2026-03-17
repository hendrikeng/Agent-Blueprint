import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createTemplateRepo, loadJson, runNode } from './test-helpers.mjs';

function directFuturePlan({
  planId,
  status = 'ready-for-promotion',
  riskTier = 'medium',
  securityApproval = 'not-required',
  validationLanes = 'always'
}) {
  return `# ${planId}

Status: ${status}

## Metadata

- Plan-ID: ${planId}
- Status: ${status}
- Priority: p1
- Owner: fixture
- Acceptance-Criteria: Deliver ${planId}.
- Delivery-Class: product
- Dependencies: none
- Spec-Targets: docs/spec.md
- Implementation-Targets: src/${planId}.js
- Risk-Tier: ${riskTier}
- Validation-Lanes: ${validationLanes}
- Security-Approval: ${securityApproval}
- Done-Evidence: pending

## Already-True Baseline

- Baseline exists.

## Must-Land Checklist

- [ ] \`ml-${planId}\` Deliver ${planId}.

## Deferred Follow-Ons

- None.
`;
}

async function configureFixtureRepo(rootDir, scenario) {
  await fs.mkdir(path.join(rootDir, 'docs', 'future'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'docs', 'product-specs'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'src'), { recursive: true });
  await fs.writeFile(path.join(rootDir, 'docs', 'spec.md'), '# Spec\n', 'utf8');
  await fs.writeFile(path.join(rootDir, 'docs', 'product-specs', 'CURRENT-STATE.md'), '# Current State\n', 'utf8');

  const configPath = path.join(rootDir, 'docs', 'ops', 'automation', 'orchestrator.config.json');
  const config = await loadJson(configPath);
  config.executor.command =
    'node ./scripts/automation/fixtures/stub-provider.mjs --result-path {result_path} --plan-file {plan_file} --plan-id {plan_id} --role {role}';
  config.executor.roles.worker.model = 'fixture-worker';
  config.executor.roles.reviewer.model = 'fixture-reviewer';
  if (scenario?.contextBudget && typeof scenario.contextBudget === 'object') {
    config.executor.contextBudget = {
      ...(config.executor.contextBudget ?? {}),
      ...scenario.contextBudget
    };
  }
  config.validation.always = [
    {
      id: 'fixture:always',
      command: 'node ./scripts/automation/fixtures/stub-validation-command.mjs --lane always',
      type: 'always'
    }
  ];
  config.validation.hostRequired = [
    {
      id: 'fixture:host',
      command: 'node ./scripts/automation/fixtures/stub-validation-command.mjs --lane host-required',
      type: 'host-required'
    }
  ];
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(rootDir, 'docs', 'ops', 'automation', 'fixture-scenario.json'),
    `${JSON.stringify(scenario, null, 2)}\n`,
    'utf8'
  );
  spawnSync('git', ['add', '.'], { cwd: rootDir, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', 'chore: seed orchestrator fixture'], { cwd: rootDir, stdio: 'pipe' });
}

test('orchestrator promotes a medium-risk future, runs worker and reviewer, then completes it', async () => {
  const rootDir = await createTemplateRepo();
  await configureFixtureRepo(rootDir, {
    providerActions: {
      'red-inbox': {
        worker: [
          {
            status: 'completed',
            summary: 'Worker delivered red inbox.',
            writeFiles: [{ path: 'src/red-inbox.js', content: 'export const color = "red";\n' }],
            plan: {
              checkMustLand: true
            }
          }
        ],
        reviewer: [
          {
            status: 'completed',
            summary: 'Reviewer approved red inbox.'
          }
        ]
      }
    },
    validation: {
      'always:red-inbox': [
        {
          status: 'passed',
          summary: 'Always validation passed.'
        }
      ]
    }
  });
  await fs.writeFile(
    path.join(rootDir, 'docs', 'future', '2026-03-17-red-inbox.md'),
    directFuturePlan({ planId: 'red-inbox', riskTier: 'medium' }),
    'utf8'
  );

  const result = runNode(
    path.join(rootDir, 'scripts', 'automation', 'orchestrator.mjs'),
    ['grind', '--max-risk', 'medium', '--output', 'minimal'],
    rootDir
  );
  assert.equal(result.status, 0, String(result.stderr));

  const completedPlanPath = path.join(rootDir, 'docs', 'exec-plans', 'completed', '2026-03-17-red-inbox.md');
  const completedPlan = await fs.readFile(completedPlanPath, 'utf8');
  assert.match(completedPlan, /^Status: completed$/m);
  assert.match(completedPlan, /^- Done-Evidence: docs\/exec-plans\/evidence-index\/red-inbox\.md$/m);

  const evidenceIndex = await fs.readFile(path.join(rootDir, 'docs', 'exec-plans', 'evidence-index', 'red-inbox.md'), 'utf8');
  assert.match(evidenceIndex, /fixture:always/);

  const events = await fs.readFile(path.join(rootDir, 'docs', 'ops', 'automation', 'run-events.jsonl'), 'utf8');
  assert.match(events, /future_promoted/);
  assert.match(events, /plan_completed/);
  assert.match(events, /plan_committed/);
  assert.match(events, /"role":"reviewer"/);

  const latestCommit = spawnSync('git', ['log', '--oneline', '--max-count', '1'], { cwd: rootDir, stdio: 'pipe', encoding: 'utf8' });
  assert.equal(latestCommit.status, 0);
  assert.match(String(latestCommit.stdout), /complete red-inbox/);
});

test('orchestrator forces a handoff when a worker returns too close to the context threshold', async () => {
  const rootDir = await createTemplateRepo();
  await configureFixtureRepo(rootDir, {
    contextBudget: {
      minRemaining: 20000,
      minRemainingPercent: 0.2
    },
    providerActions: {
      'context-threshold-plan': {
        worker: [
          {
            status: 'completed',
            summary: 'Worker paused before context edge.',
            contextRemaining: 15000,
            contextWindow: 100000,
            currentSubtask: 'Summarize remaining implementation work',
            nextAction: 'Resume with a fresh worker session and complete must-land items',
            pendingActions: ['Finish the remaining must-land implementation']
          },
          {
            status: 'completed',
            summary: 'Worker completed the plan after handoff.',
            contextRemaining: 64000,
            contextWindow: 100000,
            writeFiles: [{ path: 'src/context-threshold-plan.js', content: 'export const status = "done";\n' }],
            plan: {
              checkMustLand: true
            }
          }
        ],
        reviewer: [
          {
            status: 'completed',
            summary: 'Reviewer approved the resumed plan.'
          }
        ]
      }
    },
    validation: {
      'always:context-threshold-plan': [
        {
          status: 'passed',
          summary: 'Always validation passed.'
        }
      ]
    }
  });
  await fs.writeFile(
    path.join(rootDir, 'docs', 'future', '2026-03-17-context-threshold-plan.md'),
    directFuturePlan({ planId: 'context-threshold-plan', riskTier: 'medium' }),
    'utf8'
  );

  const result = runNode(
    path.join(rootDir, 'scripts', 'automation', 'orchestrator.mjs'),
    ['grind', '--max-risk', 'medium', '--output', 'minimal'],
    rootDir
  );
  assert.equal(result.status, 0, String(result.stderr));

  const completedPlanPath = path.join(rootDir, 'docs', 'exec-plans', 'completed', '2026-03-17-context-threshold-plan.md');
  const completedPlan = await fs.readFile(completedPlanPath, 'utf8');
  assert.match(completedPlan, /^Status: completed$/m);

  const handoff = await fs.readFile(
    path.join(rootDir, 'docs', 'ops', 'automation', 'handoffs', 'context-threshold-plan.md'),
    'utf8'
  );
  assert.match(handoff, /Context Remaining:/);

  const events = await fs.readFile(path.join(rootDir, 'docs', 'ops', 'automation', 'run-events.jsonl'), 'utf8');
  assert.match(events, /context_budget_low/);
  assert.match(events, /"status":"handoff_required"/);
});

test('orchestrator blocks high-risk work without explicit security approval', async () => {
  const rootDir = await createTemplateRepo();
  await configureFixtureRepo(rootDir, { providerActions: {}, validation: {} });
  await fs.writeFile(
    path.join(rootDir, 'docs', 'future', '2026-03-17-payments-cutover.md'),
    directFuturePlan({
      planId: 'payments-cutover',
      riskTier: 'high',
      securityApproval: 'pending'
    }),
    'utf8'
  );

  const result = runNode(
    path.join(rootDir, 'scripts', 'automation', 'orchestrator.mjs'),
    ['grind', '--max-risk', 'high', '--output', 'minimal'],
    rootDir
  );
  assert.equal(result.status, 0, String(result.stderr));

  const blockedPlan = await fs.readFile(
    path.join(rootDir, 'docs', 'exec-plans', 'active', '2026-03-17-payments-cutover.md'),
    'utf8'
  );
  assert.match(blockedPlan, /^Status: blocked$/m);
  assert.match(blockedPlan, /Security-Approval must be approved/);
});
