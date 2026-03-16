import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  parentScopeIdsForPlan,
  recompileProgramChildrenForParentScopes
} from './program-child-refresh.mjs';

async function createHarnessFixture() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'program-child-refresh-'));
  await fs.mkdir(path.join(rootDir, 'docs', 'future'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'docs', 'exec-plans', 'active'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'docs', 'exec-plans', 'completed'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'docs', 'ops', 'automation'), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, 'docs', 'ops', 'automation', 'orchestrator.config.json'),
    `${JSON.stringify({
      validation: {
        always: [{ id: 'repo:verify-fast', command: 'npm run verify:fast' }],
        hostRequired: [{ id: 'repo:verify-full', command: 'npm run verify:full' }]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  return rootDir;
}

test('parentScopeIdsForPlan resolves parent scope from program parents and child slices', () => {
  assert.deepEqual(parentScopeIdsForPlan({
    planId: 'parent-program',
    executionScope: 'program'
  }), ['parent-program']);

  assert.deepEqual(parentScopeIdsForPlan({
    planId: 'child-a',
    executionScope: 'slice',
    parentPlanId: 'parent-program'
  }), ['parent-program']);
});

test('recompileProgramChildrenForParentScopes rewrites stale generated child docs', async () => {
  const rootDir = await createHarnessFixture();
  const parentPath = path.join(rootDir, 'docs', 'future', '2026-03-16-parent-program.md');
  await fs.writeFile(parentPath, `# Parent Program

Status: ready-for-promotion
Validation-Ready: no

## Metadata

- Plan-ID: parent-program
- Status: ready-for-promotion
- Priority: p1
- Owner: planner
- Acceptance-Criteria: Complete the child queue.
- Delivery-Class: product
- Execution-Scope: program
- Authoring-Intent: executable-default
- Dependencies: none
- Autonomy-Allowed: guarded
- Risk-Tier: medium
- Security-Approval: not-required
- Spec-Targets: docs/spec.md
- Done-Evidence: pending

## Already-True Baseline

- Parent baseline.

## Must-Land Checklist

- [ ] Keep the parent active while children execute.

## Deferred Follow-Ons

- Later.

## Master Plan Coverage

| Capability | Current Status | This Plan | Later |
| --- | --- | --- | --- |
| Parent queue | foundation only | yes | no |

## Prior Completed Plan Reconciliation

- None.

## Promotion Blockers

- None.

## Child Slice Definitions

### child-a
- Title: Child A
- Dependencies: none
- Spec-Targets: docs/spec.md, src/feature-a.js
- Implementation-Targets: src/feature-a.js
- Validation-Lanes: always

#### Must-Land Checklist
- [ ] \`ml-child-a\` Ship child A

#### Already-True Baseline
- Child baseline.

#### Deferred Follow-Ons
- None.

#### Capability Proof Map
| Capability ID | Must-Land IDs | Claim | Required Strength |
| --- | --- | --- | --- |
| cap-child-a | ml-child-a | Child A ships. | strong |

| Proof ID | Capability ID | Type | Lane | Validation ID / Artifact | Freshness |
| --- | --- | --- | --- | --- | --- |
| proof-child-a | cap-child-a | integration | always | repo:verify-fast | same-run |
`, 'utf8');

  const firstCompile = await recompileProgramChildrenForParentScopes(rootDir, ['parent-program'], { write: true });
  assert.equal(firstCompile.issues.length, 0);

  const childPath = path.join(rootDir, 'docs', 'future', '2026-03-16-child-a.md');
  await fs.writeFile(childPath, '# Stale Child\n\nStatus: draft\nValidation-Ready: no\n', 'utf8');

  const secondCompile = await recompileProgramChildrenForParentScopes(rootDir, ['parent-program'], { write: true });
  assert.equal(secondCompile.issues.length, 0);

  const childContent = await fs.readFile(childPath, 'utf8');
  assert.match(childContent, /^# Child A$/m);
  assert.match(childContent, /Parent-Plan-ID: parent-program/);
});
