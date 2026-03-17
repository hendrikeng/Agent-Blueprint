import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { createTemplateRepo, runNode } from './test-helpers.mjs';

test('verify-full dry-run expands to fast plus merge-level checks', async () => {
  const rootDir = await createTemplateRepo();
  const result = runNode(path.join(rootDir, 'scripts', 'automation', 'verify-full.mjs'), ['--dry-run'], rootDir);

  assert.equal(result.status, 0, String(result.stderr));
  const stdout = String(result.stdout);
  assert.match(stdout, /verify-fast/);
  assert.match(stdout, /check-article-conformance/);
  assert.match(stdout, /check-dependencies/);
  assert.match(stdout, /check-agent-hardening/);
  assert.match(stdout, /check-evals/);
  assert.doesNotMatch(stdout, /verify-orchestration-state/);
});
