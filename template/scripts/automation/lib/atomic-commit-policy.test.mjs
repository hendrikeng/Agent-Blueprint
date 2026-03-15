import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  evaluateAtomicCommitReadiness,
  implementationEvidencePaths,
  recordImplementationEvidence,
  resolveAtomicCommitRoots
} from './atomic-commit-policy.mjs';

test('evaluateAtomicCommitReadiness refuses atomic commit when allowDirty is true', () => {
  const result = evaluateAtomicCommitReadiness('/tmp/irrelevant', 'example-plan', true, {}, {});

  assert.equal(result.ok, false);
  assert.match(result.reason, /allow-dirty true/);
});

test('resolveAtomicCommitRoots includes plan, spec, implementation, and evidence roots', () => {
  const roots = resolveAtomicCommitRoots(
    {
      planId: 'example-plan',
      rel: 'docs/exec-plans/active/2026-03-15-example-plan.md',
      specTargets: ['docs/product-specs/CURRENT-STATE.md'],
      implementationTargets: ['src/app'],
      atomicRoots: ['scripts/automation']
    },
    {
      git: {
        atomicCommitRoots: {
          defaults: ['package.json'],
          shared: ['docs/generated'],
          allowPlanMetadata: true
        }
      },
      context: {
        runtimeContextPath: 'docs/generated/AGENT-RUNTIME-CONTEXT.md'
      }
    },
    {
      rootDir: '/repo',
      evidenceIndexDir: '/repo/docs/exec-plans/evidence-index'
    },
    {
      completedRel: 'docs/exec-plans/completed/2026-03-15-example-plan.md'
    }
  );

  assert.equal(roots.includes('docs/exec-plans/active/2026-03-15-example-plan.md'), true);
  assert.equal(roots.includes('docs/exec-plans/completed/2026-03-15-example-plan.md'), true);
  assert.equal(roots.includes('docs/exec-plans/evidence-index/example-plan.md'), true);
  assert.equal(roots.includes('src/app'), true);
  assert.equal(roots.includes('scripts/automation'), true);
});

test('recordImplementationEvidence maps touched ancestor directories to declared implementation roots', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-evidence-'));
  await fs.mkdir(path.join(rootDir, 'src'), { recursive: true });
  await fs.writeFile(path.join(rootDir, 'src', 'feature.js'), 'export const feature = "ok";\n', 'utf8');
  const state = {
    implementationState: {}
  };
  const ensurePlanImplementationState = (payload, planId) => {
    payload.implementationState[planId] = payload.implementationState[planId] ?? {};
    return payload.implementationState[planId];
  };

  const result = recordImplementationEvidence(
    state,
    ensurePlanImplementationState,
    rootDir,
    {
      planId: 'example-plan',
      deliveryClass: 'product',
      executionScope: 'slice',
      implementationTargets: ['src/feature.js']
    },
    ['src']
  );

  assert.equal(result.recorded, true);
  assert.deepEqual(result.matchedPaths, ['src/feature.js']);
  assert.deepEqual(
    implementationEvidencePaths(
      state,
      {
        planId: 'example-plan',
        deliveryClass: 'product',
        executionScope: 'slice',
        implementationTargets: ['src/feature.js']
      },
      rootDir
    ),
    ['src/feature.js']
  );
});

test('recordImplementationEvidence preserves the original baseline across later worker sessions', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-evidence-'));
  await fs.mkdir(path.join(rootDir, 'src'), { recursive: true });
  const featurePath = path.join(rootDir, 'src', 'feature.js');
  await fs.writeFile(featurePath, 'export const feature = "baseline";\n', 'utf8');
  const state = {
    implementationState: {}
  };
  const ensurePlanImplementationState = (payload, planId) => {
    payload.implementationState[planId] = payload.implementationState[planId] ?? {};
    return payload.implementationState[planId];
  };
  const plan = {
    planId: 'example-plan',
    deliveryClass: 'product',
    executionScope: 'slice',
    implementationTargets: ['src/feature.js']
  };

  recordImplementationEvidence(
    state,
    ensurePlanImplementationState,
    rootDir,
    plan,
    ['src/feature.js'],
    {
      baselineFingerprints: {
        'src/feature.js': 'baseline-fingerprint'
      }
    }
  );

  await fs.writeFile(featurePath, 'export const feature = "updated";\n', 'utf8');

  recordImplementationEvidence(
    state,
    ensurePlanImplementationState,
    rootDir,
    plan,
    ['src/feature.js'],
    {
      baselineFingerprints: {
        'src/feature.js': 'newer-baseline-that-should-not-overwrite'
      }
    }
  );

  assert.equal(
    state.implementationState['example-plan'].pathRecords['src/feature.js'].baselineFingerprint,
    'baseline-fingerprint'
  );
  assert.deepEqual(implementationEvidencePaths(state, plan, rootDir), ['src/feature.js']);
});
