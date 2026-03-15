import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const orchestratorPath = new URL('./orchestrator.mjs', import.meta.url);

test('orchestrator imports implementationEvidenceFingerprint when baseline capture uses it', async () => {
  const raw = await fs.readFile(orchestratorPath, 'utf8');

  assert.match(raw, /function captureImplementationBaseline\(/);
  assert.match(raw, /implementationEvidenceFingerprint\(/);

  const importBlock = raw.split("} from './lib/atomic-commit-policy.mjs';")[0];
  assert.match(importBlock, /implementationEvidenceFingerprint,/);
});
