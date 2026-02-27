#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const requiredFiles = [
  'docs/agent-hardening/README.md',
  'docs/agent-hardening/EVALS.md',
  'docs/agent-hardening/OBSERVABILITY.md',
  'docs/agent-hardening/TOOL_POLICY.md',
  'docs/agent-hardening/MEMORY_CONTEXT.md'
];

const requiredMetadataFields = ['Status', 'Owner', 'Last Updated', 'Source of Truth'];

const requiredHeadings = {
  'docs/agent-hardening/README.md': ['Why This Exists', 'Canonical Documents', 'Enforcement'],
  'docs/agent-hardening/EVALS.md': ['Eval Lifecycle', 'Failure Taxonomy', 'Release Gates'],
  'docs/agent-hardening/OBSERVABILITY.md': ['Required Run Trace Fields', 'Error Classification', 'Retention and Redaction'],
  'docs/agent-hardening/TOOL_POLICY.md': ['Risk Tiers', 'Approval Requirements', 'Execution Safety Rules'],
  'docs/agent-hardening/MEMORY_CONTEXT.md': ['Context Budget Rules', 'Persistence Rules', 'Provenance and Redaction']
};

const findings = [];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function checkMetadata(content, filePath) {
  for (const field of requiredMetadataFields) {
    const regex = new RegExp(`^${escapeRegex(field)}:\\s+.+$`, 'm');
    if (!regex.test(content)) {
      findings.push(`[MISSING_METADATA] ${filePath} missing metadata field "${field}:"`);
    }
  }
}

function checkHeadings(content, filePath) {
  for (const heading of requiredHeadings[filePath] ?? []) {
    const regex = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`, 'm');
    if (!regex.test(content)) {
      findings.push(`[MISSING_HEADING] ${filePath} missing heading "## ${heading}"`);
    }
  }
}

for (const relPath of requiredFiles) {
  const absPath = path.join(rootDir, relPath);
  if (!(await fileExists(absPath))) {
    findings.push(`[MISSING_FILE] ${relPath}`);
    continue;
  }

  const content = await fs.readFile(absPath, 'utf8');
  checkMetadata(content, relPath);
  checkHeadings(content, relPath);
}

if (findings.length > 0) {
  console.error(`[agent-verify] failed with ${findings.length} issue(s):`);
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`[agent-verify] passed (${requiredFiles.length} required files).`);
