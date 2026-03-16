import test from 'node:test';
import assert from 'node:assert/strict';

import {
  disallowedWorkerTouchedPaths,
  implementationTargetRoots,
  pathMatchesRootPrefix,
  specTargetDocRoots
} from './plan-scope.mjs';

test('implementationTargetRoots keeps only executable code-oriented roots', () => {
  const plan = {
    implementationTargets: [
      'apps/api/src/reporting',
      'apps/agent-web/app/opportunities',
      'packages/types/test',
      'docs/product-specs/CURRENT-STATE.md'
    ]
  };

  assert.deepEqual(implementationTargetRoots(plan), [
    'apps/api/src/reporting',
    'apps/agent-web/app/opportunities',
    'packages/types/test'
  ]);
});

test('disallowedWorkerTouchedPaths rejects worker edits outside declared implementation targets', () => {
  const plan = {
    implementationTargets: [
      'apps/api/src/reporting',
      'apps/agent-web/app/opportunities'
    ]
  };

  assert.deepEqual(
    disallowedWorkerTouchedPaths(plan, [
      'apps/api/src/reporting/reporting.service.ts',
      'apps/agent-web/app/opportunities/page.test.ts',
      'docs/exec-plans/active/evidence/example.md',
      'packages/types/src/reporting/optimization-opportunities.ts',
      'packages/types/test/platform-foundation-contracts.test.ts'
    ]),
    [
      'packages/types/src/reporting/optimization-opportunities.ts',
      'packages/types/test/platform-foundation-contracts.test.ts'
    ]
  );
});

test('specTargetDocRoots keeps only declared doc-oriented spec targets', () => {
  const plan = {
    specTargets: [
      'docs/product-specs/roadmap.md',
      'README.md',
      'apps/api/src/reporting'
    ]
  };

  assert.deepEqual(specTargetDocRoots(plan), [
    'docs/product-specs/roadmap.md',
    'README.md'
  ]);
});

test('disallowedWorkerTouchedPaths allows declared spec doc edits when implementation roots were also touched', () => {
  const plan = {
    specTargets: [
      'docs/product-specs/roadmap.md',
      'docs/FRONTEND.md'
    ],
    implementationTargets: [
      'apps/api/src/reporting',
      'apps/agent-web/app/opportunities'
    ]
  };

  assert.deepEqual(
    disallowedWorkerTouchedPaths(plan, [
      'apps/api/src/reporting/reporting.service.ts',
      'docs/product-specs/roadmap.md',
      'docs/FRONTEND.md'
    ]),
    []
  );
});

test('disallowedWorkerTouchedPaths still rejects declared spec doc edits without implementation touches', () => {
  const plan = {
    specTargets: [
      'docs/product-specs/roadmap.md'
    ],
    implementationTargets: [
      'apps/api/src/reporting'
    ]
  };

  assert.deepEqual(
    disallowedWorkerTouchedPaths(plan, [
      'docs/product-specs/roadmap.md'
    ]),
    ['docs/product-specs/roadmap.md']
  );
});

test('pathMatchesRootPrefix matches exact files and descendants only', () => {
  assert.equal(pathMatchesRootPrefix('packages/types/test/platform-foundation-contracts.test.ts', 'packages/types/test'), true);
  assert.equal(pathMatchesRootPrefix('packages/types/test-helper.ts', 'packages/types/test'), false);
});
