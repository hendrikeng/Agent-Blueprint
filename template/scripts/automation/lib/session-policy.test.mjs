import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorkerTouchPolicy,
  disallowedTouchedPathsForRole,
  hasMeaningfulWorkerTouchSummary
} from './session-policy.mjs';

test('buildWorkerTouchPolicy allows docs-only artifact plans to count scoped docs progress', () => {
  const plan = {
    planId: 'docs-slice',
    rel: 'docs/exec-plans/active/2026-03-15-docs-slice.md',
    deliveryClass: 'docs',
    executionScope: 'slice',
    specTargets: ['docs/README.md'],
    content: '# Docs Slice\n\nStatus: in-progress\nValidation-Ready: no\n'
  };

  const policy = buildWorkerTouchPolicy(plan);

  assert.equal(policy.docsOnlySpecTargets, true);
  assert.equal(policy.allowPlanDocsOnlyTouches, true);
  assert.equal(policy.allowedTouchRoots.includes('docs/README.md'), true);
});

test('buildWorkerTouchPolicy requires implementation-root touches for product plans', () => {
  const plan = {
    planId: 'product-slice',
    rel: 'docs/exec-plans/active/2026-03-15-product-slice.md',
    deliveryClass: 'product',
    executionScope: 'slice',
    specTargets: ['docs/product-specs/roadmap.md', 'apps/api/src/reporting'],
    implementationTargets: ['apps/api/src/reporting'],
    content: '# Product Slice\n\nStatus: in-progress\nValidation-Ready: no\n'
  };

  const policy = buildWorkerTouchPolicy(plan);

  assert.equal(policy.allowPlanDocsOnlyTouches, false);
  assert.equal(policy.requireImplementationTouch, true);
  assert.deepEqual(policy.implementationTouchRoots, ['apps/api/src/reporting']);
  assert.deepEqual(policy.declaredSpecDocTouchRoots, ['docs/product-specs/roadmap.md']);
});

test('disallowedTouchedPathsForRole keeps non-worker roles inside exec-plan docs only', () => {
  assert.deepEqual(
    disallowedTouchedPathsForRole('reviewer', {}, [
      'docs/exec-plans/active/example.md',
      'src/app.ts',
      'docs/README.md'
    ]),
    ['src/app.ts', 'docs/README.md']
  );
});

test('hasMeaningfulWorkerTouchSummary ignores plan-doc-only touches for product plans', () => {
  const policy = {
    allowPlanDocsOnlyTouches: false
  };
  const summary = {
    touched: ['docs/exec-plans/active/example.md']
  };

  assert.equal(hasMeaningfulWorkerTouchSummary(summary, policy), false);
});

test('hasMeaningfulWorkerTouchSummary ignores spec-doc-only touches for product plans', () => {
  const policy = {
    allowPlanDocsOnlyTouches: false,
    requireImplementationTouch: true,
    implementationTouchRoots: ['apps/api/src/reporting']
  };
  const summary = {
    touched: ['docs/product-specs/roadmap.md']
  };

  assert.equal(hasMeaningfulWorkerTouchSummary(summary, policy), false);
});

test('hasMeaningfulWorkerTouchSummary accepts implementation touches that accompany declared spec docs', () => {
  const policy = {
    allowPlanDocsOnlyTouches: false,
    requireImplementationTouch: true,
    implementationTouchRoots: ['apps/api/src/reporting']
  };
  const summary = {
    touched: [
      'apps/api/src/reporting/reporting.service.ts',
      'docs/product-specs/roadmap.md'
    ]
  };

  assert.equal(hasMeaningfulWorkerTouchSummary(summary, policy), true);
});
