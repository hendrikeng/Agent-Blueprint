import test from 'node:test';
import assert from 'node:assert/strict';

import {
  disallowedWorkerTouchedPaths,
  implementationTargetRoots,
  pathMatchesRootPrefix
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

test('pathMatchesRootPrefix matches exact files and descendants only', () => {
  assert.equal(pathMatchesRootPrefix('packages/types/test/platform-foundation-contracts.test.ts', 'packages/types/test'), true);
  assert.equal(pathMatchesRootPrefix('packages/types/test-helper.ts', 'packages/types/test'), false);
});
