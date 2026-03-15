#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  extractProgramChildUnitDeclarations,
  metadataValue,
  parseDeliveryClass,
  parseExecutionScope,
  parseMetadata,
  parsePlanId,
  parseValidationLanes
} from './lib/plan-metadata.mjs';
import {
  removeSection,
  sectionBody,
  upsertSection
} from './lib/plan-document-state.mjs';

const CHILD_SECTION_TITLE = 'Child Slice Definitions';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function asBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function usage() {
  process.stderr.write(
    'Usage: node ./scripts/automation/migrate-program-children.mjs --plan-file <path> [--write true|false]\n'
  );
}

function normalizePathEntries(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function inferredImplementationTargets(specTargets) {
  const codeLike = specTargets.filter((target) => !target.startsWith('docs/'));
  if (codeLike.length > 0) {
    return codeLike;
  }
  return ['review-required'];
}

function defaultValidationLanes(metadata) {
  const lanes = parseValidationLanes(metadataValue(metadata, 'Validation-Lanes'));
  return lanes.length > 0 ? lanes : ['always'];
}

function renderProofMap(planId, lanes) {
  const primaryLane = lanes[0] ?? 'always';
  const validationRef = primaryLane === 'host-required' ? 'review-required-host' : 'review-required';
  return [
    '| Capability ID | Must-Land IDs | Claim | Required Strength |',
    '| --- | --- | --- | --- |',
    `| cap-${planId} | ml-${planId} | Review and preserve legacy child intent for ${planId}. | medium |`,
    '',
    '| Proof ID | Capability ID | Type | Lane | Validation ID / Artifact | Freshness |',
    '| --- | --- | --- | --- | --- | --- |',
    `| proof-${planId} | cap-${planId} | migration | ${primaryLane} | ${validationRef} | migration-review |`
  ].join('\n');
}

function renderChildDefinitions(content, declarations) {
  const metadata = parseMetadata(content);
  const deliveryClass = parseDeliveryClass(metadataValue(metadata, 'Delivery-Class'), '');
  const specTargets = normalizePathEntries(metadataValue(metadata, 'Spec-Targets'));
  const implementationTargets = inferredImplementationTargets(specTargets);
  const lanes = defaultValidationLanes(metadata);
  const body = [];

  for (const declaration of declarations) {
    const planId =
      declaration.planIdHint ??
      parsePlanId(
        declaration.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        null
      ) ??
      'review-required';
    body.push(`### ${planId}`);
    body.push(`- Title: ${declaration.title}`);
    body.push('- Dependencies: none');
    body.push(`- Spec-Targets: ${specTargets.length > 0 ? specTargets.join(', ') : 'review-required'}`);
    if (deliveryClass === 'product') {
      body.push(`- Implementation-Targets: ${implementationTargets.join(', ')}`);
    }
    body.push(`- Validation-Lanes: ${lanes.join(', ')}`);
    body.push('');
    body.push('#### Must-Land Checklist');
    body.push(`- [ ] \`ml-${planId}\` Migrate legacy child intent from \`${declaration.sectionTitle}\` heading \`${declaration.rawHeading}\`.`);
    body.push('');
    body.push('#### Already-True Baseline');
    body.push(`- Legacy parent already declared this child under \`${declaration.sectionTitle}\`.`);
    body.push('');
    body.push('#### Deferred Follow-Ons');
    body.push('- Review and split any remaining non-executable backlog after structured child generation.');
    body.push('');
    if (deliveryClass === 'product') {
      body.push('#### Capability Proof Map');
      body.push(renderProofMap(planId, lanes));
      body.push('');
    }
  }

  return body.join('\n').trim();
}

export function migrateProgramChildDefinitions(content) {
  const metadata = parseMetadata(content);
  const executionScope = parseExecutionScope(metadataValue(metadata, 'Execution-Scope'), '');
  if (executionScope !== 'program') {
    throw new Error("Only 'Execution-Scope: program' plans can be migrated.");
  }
  if (sectionBody(content, CHILD_SECTION_TITLE)) {
    throw new Error(`Plan already contains '## ${CHILD_SECTION_TITLE}'.`);
  }

  const declarations = extractProgramChildUnitDeclarations(content);
  if (declarations.length === 0) {
    throw new Error('No legacy child-unit headings found.');
  }

  let updated = content;
  for (const sectionTitle of [...new Set(declarations.map((entry) => entry.sectionTitle))]) {
    updated = removeSection(updated, sectionTitle);
  }
  updated = upsertSection(updated, CHILD_SECTION_TITLE, renderChildDefinitions(content, declarations));
  return {
    declarations,
    content: updated
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const planFile = String(options['plan-file'] ?? '').trim();
  if (!planFile) {
    usage();
    process.exit(1);
  }

  const absPath = path.resolve(planFile);
  const content = await fs.readFile(absPath, 'utf8');
  const migration = migrateProgramChildDefinitions(content);

  if (asBoolean(options.write, false)) {
    await fs.writeFile(absPath, migration.content, 'utf8');
    process.stderr.write(
      `[migrate-program-children] wrote ${path.relative(process.cwd(), absPath)} with ${migration.declarations.length} child definition(s).\n`
    );
    return;
  }

  process.stderr.write(
    `[migrate-program-children] preview generated ${migration.declarations.length} structured child definition(s) for ${path.relative(process.cwd(), absPath)}.\n`
  );
  process.stdout.write(`${migration.content}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`[migrate-program-children] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
