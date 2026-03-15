import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_EXECUTOR_PROMPT_TEMPLATE_REF,
  DEFAULT_EXECUTOR_PROMPT_TEMPLATE,
  resolveExecutorPromptTemplate
} from './executor-policy.mjs';

test('canonical executor prompt reference resolves to the shared template', () => {
  assert.equal(resolveExecutorPromptTemplate(CANONICAL_EXECUTOR_PROMPT_TEMPLATE_REF), DEFAULT_EXECUTOR_PROMPT_TEMPLATE);
});

test('empty executor prompt resolves to the shared template', () => {
  assert.equal(resolveExecutorPromptTemplate(''), DEFAULT_EXECUTOR_PROMPT_TEMPLATE);
});

test('resolved canonical prompt retains required placeholders and policy markers', () => {
  const prompt = resolveExecutorPromptTemplate(CANONICAL_EXECUTOR_PROMPT_TEMPLATE_REF);
  assert.equal(prompt.includes('{contact_pack_file}'), true);
  assert.equal(prompt.includes('Implementation-Targets'), true);
  assert.equal(prompt.includes('currentSubtask'), true);
});
