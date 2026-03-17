import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createTemplateRepo, runNode } from './test-helpers.mjs';

test('context:compile is deterministic when sources are unchanged', async () => {
  const rootDir = await createTemplateRepo();
  const result = runNode(path.join(rootDir, 'scripts', 'automation', 'compile-runtime-context.mjs'), [], rootDir);

  assert.equal(result.status, 0, String(result.stderr));
  const gitStatus = spawnSync('git', ['status', '--short'], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  assert.equal(gitStatus.status, 0, String(gitStatus.stderr));
  assert.equal(String(gitStatus.stdout).trim(), '');
});
