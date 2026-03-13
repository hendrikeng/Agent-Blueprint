#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  metadataValue,
  parseListField,
  parseMetadata,
  parseRiskTier
} from './lib/plan-metadata.mjs';

const DEFAULT_POLICY_PATH = 'docs/governance/policy-manifest.json';
const DEFAULT_CONFIG_PATH = 'docs/ops/automation/orchestrator.config.json';
const DEFAULT_RUNTIME_CONTEXT_PATH = 'docs/generated/agent-runtime-context.md';
const DEFAULT_OUTPUT_PATH = 'docs/ops/automation/runtime/contacts/manual/contact-pack.md';
const DEFAULT_MAX_POLICY_BULLETS = 10;
const DEFAULT_MAX_RECENT_EVIDENCE_ITEMS = 6;
const DEFAULT_MAX_RECENT_CHECKPOINT_ITEMS = 2;
const DEFAULT_MAX_STATE_LIST_ITEMS = 6;

const ROLE_NAMES = new Set(['planner', 'explorer', 'worker', 'reviewer']);

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

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function resolveDocRef(target, sourceFile) {
  const trimmed = String(target ?? '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return null;
  }
  const withoutHash = trimmed.split('#')[0]?.split('?')[0] ?? '';
  if (!withoutHash) {
    return null;
  }
  if (withoutHash.startsWith('/')) {
    return toPosix(withoutHash.slice(1));
  }
  const sourceDir = path.posix.dirname(toPosix(sourceFile));
  return toPosix(path.posix.normalize(path.posix.join(sourceDir, withoutHash)));
}

function absolutizeMarkdownLinks(line, sourceFile) {
  return String(line ?? '').replace(/\[([^\]]*)\]\(([^)]+)\)/g, (full, label, target) => {
    const resolved = resolveDocRef(target, sourceFile);
    if (!resolved) {
      return full;
    }
    return `[${label}](${resolved})`;
  });
}

function asInteger(value, fallback) {
  if (value == null) {
    return fallback;
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback = false) {
  if (value == null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return fallback;
}

function normalizeRoleName(value, fallback = 'worker') {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ROLE_NAMES.has(normalized) ? normalized : fallback;
}

function normalizeReasoningEffort(value, fallback = 'n/a') {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['low', 'medium', 'high', 'xhigh'].includes(normalized) ? normalized : fallback;
}

function resolveRoleReasoningEffort(roleProfile, roleContract, effectiveRiskTier) {
  const normalizedRiskTier = parseRiskTier(effectiveRiskTier, 'low');
  const effortByRisk =
    roleProfile?.reasoningEffortByRisk && typeof roleProfile.reasoningEffortByRisk === 'object'
      ? roleProfile.reasoningEffortByRisk
      : {};
  const riskOverride = normalizeReasoningEffort(effortByRisk[normalizedRiskTier], '');
  if (riskOverride) {
    return riskOverride;
  }
  const profileEffort = normalizeReasoningEffort(roleProfile?.reasoningEffort, '');
  if (profileEffort) {
    return profileEffort;
  }
  return normalizeReasoningEffort(roleContract?.reasoningEffort, 'n/a');
}

function unique(items) {
  return [...new Set(items.map((entry) => String(entry ?? '').trim()).filter(Boolean))];
}

function summarizeList(items, maxItems, maxWords = 10) {
  const source = Array.isArray(items) ? items : [items];
  return unique(source)
    .slice(0, Math.max(0, maxItems))
    .map((entry) => summarizeSentence(entry, maxWords));
}

function summarizeSentence(value, maxWords = 24) {
  const words = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function parseEvidenceReferences(raw, maxItems, sourceFile) {
  const lines = String(raw ?? '').split(/\r?\n/);
  const matches = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('- ')) {
      matches.push(absolutizeMarkdownLinks(trimmed.slice(2).trim(), sourceFile));
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      matches.push(absolutizeMarkdownLinks(trimmed.replace(/^\d+\.\s+/, '').trim(), sourceFile));
      continue;
    }
    const bracketMatch = trimmed.match(/\[.+?\]\(.+?\)/);
    if (bracketMatch) {
      matches.push(absolutizeMarkdownLinks(bracketMatch[0], sourceFile));
    }
  }
  return unique(matches).slice(0, Math.max(0, maxItems));
}

function parseJsonLines(raw, maxItems) {
  const lines = String(raw ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const items = [];
  const limit = Number.isFinite(maxItems) ? Math.max(0, maxItems) : lines.length;
  for (const line of lines.slice(-limit)) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object') {
        items.push(parsed);
      }
    } catch {
      // Ignore malformed historical lines; keep the pack compiler resilient.
    }
  }
  return items;
}

function normalizeContinuityPayload(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const reasoning = source.reasoning && typeof source.reasoning === 'object' ? source.reasoning : {};
  const evidence = source.evidence && typeof source.evidence === 'object' ? source.evidence : {};
  return {
    role: String(source.role ?? '').trim(),
    summary: String(source.summary ?? '').trim(),
    goal: String(source.goal ?? '').trim(),
    currentSubtask: String(source.currentSubtask ?? '').trim(),
    status: String(source.status ?? '').trim(),
    acceptedFacts: summarizeList(source.acceptedFacts, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    decisions: summarizeList(source.decisions, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    openQuestions: summarizeList(source.openQuestions, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    pendingActions: summarizeList(source.pendingActions, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    completedWork: summarizeList(source.completedWork, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    recentResults: summarizeList(source.recentResults, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    artifacts: summarizeList(source.artifacts, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    risks: summarizeList(source.risks, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
    reasoning: {
      nextAction: String(reasoning.nextAction ?? '').trim(),
      blockers: summarizeList(reasoning.blockers, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
      rationale: summarizeList(reasoning.rationale, DEFAULT_MAX_STATE_LIST_ITEMS, 12)
    },
    evidence: {
      extractedFacts: summarizeList(evidence.extractedFacts, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
      artifactRefs: summarizeList(evidence.artifactRefs, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
      logRefs: summarizeList(evidence.logRefs, DEFAULT_MAX_STATE_LIST_ITEMS, 12),
      validationRefs: summarizeList(evidence.validationRefs, DEFAULT_MAX_STATE_LIST_ITEMS, 12)
    }
  };
}

function normalizeMemoryPosture(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    whatToDo: unique(Array.isArray(source.whatToDo) ? source.whatToDo : []).slice(0, 5),
    improveBeforeRearchitecture: unique(Array.isArray(source.improveBeforeRearchitecture) ? source.improveBeforeRearchitecture : []).slice(0, 5),
    doNotAddYet: unique(Array.isArray(source.doNotAddYet) ? source.doNotAddYet : []).slice(0, 4),
    escalateWhen: unique(Array.isArray(source.escalateWhen) ? source.escalateWhen : []).slice(0, 4),
    safeRule: String(source.safeRule ?? '').trim()
  };
}

function checkpointKey(checkpoint) {
  return [
    String(checkpoint?.role ?? '').trim(),
    String(checkpoint?.status ?? '').trim(),
    String(checkpoint?.currentSubtask ?? checkpoint?.summary ?? '').trim(),
    String(checkpoint?.nextAction ?? checkpoint?.reasoning?.nextAction ?? '').trim(),
    String(checkpoint?.session ?? '').trim(),
    String(checkpoint?.stageIndex ?? '').trim()
  ].join('|');
}

function selectRelevantCheckpoints(checkpoints, role, maxItems) {
  if (maxItems <= 0) {
    return [];
  }
  const source = Array.isArray(checkpoints) ? checkpoints.filter((entry) => entry && typeof entry === 'object') : [];
  if (source.length === 0) {
    return [];
  }
  const selected = [];
  const seen = new Set();
  const reversed = [...source].reverse();
  const pick = (predicate) => {
    const match = reversed.find((entry) => !seen.has(checkpointKey(entry)) && predicate(entry));
    if (!match) {
      return;
    }
    selected.push(match);
    seen.add(checkpointKey(match));
  };

  pick(() => true);
  pick((entry) => String(entry?.role ?? '').trim().toLowerCase() === role);

  const latest = selected[0] ?? null;
  pick((entry) => {
    const entryRole = String(entry?.role ?? '').trim().toLowerCase();
    const entryStageIndex = asInteger(entry?.stageIndex, -1);
    const latestStageIndex = asInteger(latest?.stageIndex, -1);
    return entryRole !== role || (latest && entryStageIndex !== latestStageIndex);
  });

  for (const entry of reversed) {
    if (selected.length >= maxItems) {
      break;
    }
    const key = checkpointKey(entry);
    if (seen.has(key)) {
      continue;
    }
    selected.push(entry);
    seen.add(key);
  }

  return selected.slice(0, maxItems).map((entry) => normalizeContinuityPayload(entry));
}

function preferredEvidenceReferences(latestState) {
  if (!latestState) {
    return [];
  }
  return unique([
    ...(Array.isArray(latestState.evidence?.validationRefs) ? latestState.evidence.validationRefs : []),
    ...(Array.isArray(latestState.evidence?.artifactRefs) ? latestState.evidence.artifactRefs : []),
    ...(Array.isArray(latestState.evidence?.logRefs) ? latestState.evidence.logRefs : []),
    ...(Array.isArray(latestState.artifacts) ? latestState.artifacts : [])
  ]);
}

function renderSummaryBullet(label, values) {
  const entries = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean);
  if (entries.length === 0) {
    return `- ${label}: none`;
  }
  return `- ${label}: ${entries.join(' ; ')}`;
}

function summarizeCheckpoint(checkpoint) {
  const role = String(checkpoint?.role ?? 'worker').trim();
  const status = String(checkpoint?.status ?? 'unknown').trim();
  const subtask = summarizeSentence(checkpoint?.currentSubtask ?? checkpoint?.summary ?? 'n/a', 12);
  const nextAction = summarizeSentence(checkpoint?.reasoning?.nextAction ?? checkpoint?.nextAction ?? 'n/a', 12);
  return `role=${role} status=${status} subtask=${subtask} next=${nextAction}`;
}

async function readJsonStrict(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${toPosix(filePath)}: ${message}`);
  }
}

async function readUtf8IfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function compileTaskContactPack(input) {
  const rootDir = path.resolve(String(input.rootDir ?? process.cwd()));
  const planId = String(input.planId ?? '').trim();
  const planFile = String(input.planFile ?? '').trim();
  if (!planId) {
    throw new Error('Missing planId for contact-pack compilation.');
  }
  if (!planFile) {
    throw new Error('Missing planFile for contact-pack compilation.');
  }

  const policyPath = path.resolve(rootDir, String(input.policyPath ?? DEFAULT_POLICY_PATH));
  const configPath = path.resolve(rootDir, String(input.configPath ?? DEFAULT_CONFIG_PATH));
  const outputPath = path.resolve(rootDir, String(input.outputPath ?? DEFAULT_OUTPUT_PATH));
  const role = normalizeRoleName(input.role, 'worker');
  const stageIndex = Math.max(1, asInteger(input.stageIndex, 1));
  const stageTotal = Math.max(stageIndex, asInteger(input.stageTotal, stageIndex));

  const [policyManifest, config, planRaw] = await Promise.all([
    readJsonStrict(policyPath),
    readJsonStrict(configPath),
    fs.readFile(path.resolve(rootDir, planFile), 'utf8')
  ]);

  const metadata = parseMetadata(planRaw);
  const dependencies = parseListField(metadataValue(metadata, 'Dependencies'));
  const specTargets = parseListField(metadataValue(metadata, 'Spec-Targets'));
  const tags = parseListField(metadataValue(metadata, 'Tags'));
  const acceptanceCriteria = metadataValue(metadata, 'Acceptance-Criteria') ?? '';
  const declaredRiskTier = parseRiskTier(
    input.declaredRiskTier ?? metadataValue(metadata, 'Risk-Tier'),
    'low'
  );
  const effectiveRiskTier = parseRiskTier(input.effectiveRiskTier, declaredRiskTier);

  const roleContracts = policyManifest?.roleContracts ?? {};
  const validationPolicy = policyManifest?.validationPolicy ?? {};
  const memoryPosture = normalizeMemoryPosture(policyManifest?.memoryPosture);
  const mandatoryRules = Array.isArray(policyManifest?.mandatorySafetyRules)
    ? policyManifest.mandatorySafetyRules.filter((entry) => entry && typeof entry === 'object')
    : [];
  const requiredRules = mandatoryRules.filter((entry) => entry.requiredInRuntimeContext !== false);
  const ruleSource = requiredRules.length > 0 ? requiredRules : mandatoryRules;

  const configuredContactPacks = config?.context?.contactPacks ?? {};
  const maxPolicyBullets = Math.max(
    1,
    asInteger(input.maxPolicyBullets, asInteger(configuredContactPacks.maxPolicyBullets, DEFAULT_MAX_POLICY_BULLETS))
  );
  const maxRecentEvidenceItems = Math.max(
    0,
    asInteger(
      input.maxRecentEvidenceItems,
      asInteger(configuredContactPacks.maxRecentEvidenceItems, DEFAULT_MAX_RECENT_EVIDENCE_ITEMS)
    )
  );
  const includeRecentEvidence = asBoolean(
    input.includeRecentEvidence,
    asBoolean(configuredContactPacks.includeRecentEvidence, true)
  );
  const includeLatestState = asBoolean(
    input.includeLatestState,
    asBoolean(configuredContactPacks.includeLatestState, true)
  );
  const maxRecentCheckpointItems = Math.max(
    0,
    asInteger(
      input.maxRecentCheckpointItems,
      asInteger(
        configuredContactPacks.maxRecentCheckpointItems,
        DEFAULT_MAX_RECENT_CHECKPOINT_ITEMS
      )
    )
  );
  const maxStateListItems = Math.max(
    1,
    asInteger(
      input.maxStateListItems,
      asInteger(configuredContactPacks.maxStateListItems, DEFAULT_MAX_STATE_LIST_ITEMS)
    )
  );
  const runtimeContextPath =
    String(input.runtimeContextPath ?? config?.context?.runtimeContextPath ?? DEFAULT_RUNTIME_CONTEXT_PATH).trim() ||
    DEFAULT_RUNTIME_CONTEXT_PATH;

  const roleContract = roleContracts?.[role] ?? {};
  const roleProfile = config?.roleOrchestration?.roleProfiles?.[role] ?? {};
  const resolvedReasoningEffort = resolveRoleReasoningEffort(roleProfile, roleContract, effectiveRiskTier);

  const evidenceCandidates = [
    path.join(rootDir, 'docs', 'exec-plans', 'evidence-index', `${planId}.md`),
    path.join(rootDir, 'docs', 'exec-plans', 'active', 'evidence', `${planId}.md`)
  ];
  const continuityDir = path.join(rootDir, 'docs', 'ops', 'automation', 'runtime', 'state', planId);
  const latestStatePath = path.join(continuityDir, 'latest.json');
  const checkpointsPath = path.join(continuityDir, 'checkpoints.jsonl');
  let latestState = null;
  let recentCheckpoints = [];
  if (includeLatestState) {
    latestState = normalizeContinuityPayload(await readJsonStrict(latestStatePath).catch(() => null));
    const checkpointsRaw = await readUtf8IfExists(checkpointsPath);
    recentCheckpoints = selectRelevantCheckpoints(
      parseJsonLines(checkpointsRaw, Number.POSITIVE_INFINITY),
      role,
      maxRecentCheckpointItems
    );
  }

  const evidenceReferences = [];
  if (includeRecentEvidence && maxRecentEvidenceItems > 0) {
    for (const entry of preferredEvidenceReferences(latestState)) {
      evidenceReferences.push(entry);
      if (evidenceReferences.length >= maxRecentEvidenceItems) {
        break;
      }
    }
    if (evidenceReferences.length < maxRecentEvidenceItems) {
      for (const evidencePath of evidenceCandidates) {
        const evidenceRaw = await readUtf8IfExists(evidencePath);
        if (!evidenceRaw) {
          continue;
        }
        const evidenceRel = toPosix(path.relative(rootDir, evidencePath));
        const parsed = parseEvidenceReferences(evidenceRaw, maxRecentEvidenceItems, evidenceRel);
        for (const entry of parsed) {
          if (evidenceReferences.includes(entry)) {
            continue;
          }
          evidenceReferences.push(entry);
          if (evidenceReferences.length >= maxRecentEvidenceItems) {
            break;
          }
        }
        if (evidenceReferences.length >= maxRecentEvidenceItems) {
          break;
        }
      }
    }
  }

  const renderedRules = ruleSource.slice(0, maxPolicyBullets);
  const lines = [];
  lines.push('# Task Contact Pack');
  lines.push('');
  lines.push(`Generated At: ${new Date().toISOString()}`);
  lines.push(`Plan-ID: ${planId}`);
  lines.push(`Plan-File: ${toPosix(planFile)}`);
  lines.push(`Role: ${role}`);
  lines.push(`Risk: declared=${declaredRiskTier}, effective=${effectiveRiskTier}`);
  lines.push(`Stage: ${stageIndex}/${stageTotal}`);
  lines.push(`Runtime-Context: ${toPosix(runtimeContextPath)}`);
  lines.push('');
  lines.push('## Task Scope');
  lines.push(`- Acceptance criteria: ${summarizeSentence(acceptanceCriteria || 'See plan metadata for acceptance criteria.', 28)}`);
  lines.push(`- Dependencies: ${dependencies.length > 0 ? dependencies.join(', ') : 'none'}`);
  lines.push(`- Spec targets: ${specTargets.length > 0 ? specTargets.join(', ') : 'none'}`);
  lines.push(`- Tags: ${tags.length > 0 ? tags.join(', ') : 'none'}`);
  lines.push('');
  lines.push('## Hard Safety Rules');
  if (renderedRules.length === 0) {
    lines.push('- none');
  } else {
    for (const rule of renderedRules) {
      lines.push(`- [${rule.id}] ${rule.statement}`);
    }
  }
  lines.push('');
  lines.push('## Memory Posture');
  for (const bullet of memoryPosture.whatToDo) {
    lines.push(`- do: ${summarizeSentence(bullet, 22)}`);
  }
  if (memoryPosture.improveBeforeRearchitecture.length > 0) {
    lines.push(`- improve first: ${memoryPosture.improveBeforeRearchitecture.join(' ; ')}`);
  }
  if (memoryPosture.doNotAddYet.length > 0) {
    lines.push(`- not yet: ${memoryPosture.doNotAddYet.join(' ; ')}`);
  }
  if (memoryPosture.escalateWhen.length > 0) {
    lines.push(`- escalate when: ${memoryPosture.escalateWhen.join(' ; ')}`);
  }
  if (memoryPosture.safeRule) {
    lines.push(`- safe rule: ${memoryPosture.safeRule}`);
  }
  lines.push('');
  lines.push('## Role Contract');
  lines.push(`- intent: ${summarizeSentence(roleContract?.intent ?? 'No role intent configured.', 22)}`);
  lines.push(`- sandbox: ${String(roleContract?.sandboxMode ?? roleProfile?.sandboxMode ?? 'n/a').trim()}`);
  lines.push(`- reasoning: ${resolvedReasoningEffort}`);
  lines.push(`- profile model: ${String(roleProfile?.model ?? 'n/a').trim() || 'n/a'}`);
  lines.push(`- role instructions: ${summarizeSentence(roleProfile?.instructions ?? 'No role instructions configured.', 24)}`);
  lines.push('');
  lines.push('## Current State');
  if (!includeLatestState) {
    lines.push('- skipped (includeLatestState=false)');
  } else if (!latestState) {
    lines.push('- none');
  } else {
    lines.push(`- status: ${latestState.status || 'none'}`);
    lines.push(`- current subtask: ${latestState.currentSubtask || 'none'}`);
    lines.push(`- next action: ${latestState.reasoning.nextAction || 'none'}`);
    lines.push(renderSummaryBullet('pending actions', summarizeList(latestState.pendingActions, maxStateListItems, 12)));
    lines.push(renderSummaryBullet('open questions', summarizeList(latestState.openQuestions, maxStateListItems, 12)));
    lines.push(renderSummaryBullet('risks', summarizeList(latestState.risks, maxStateListItems, 12)));
    lines.push(renderSummaryBullet('completed work', summarizeList(latestState.completedWork, maxStateListItems, 12)));
    lines.push(renderSummaryBullet('accepted facts', summarizeList(latestState.acceptedFacts, maxStateListItems, 12)));
    const currentArtifacts = summarizeList(
      [
        ...latestState.artifacts,
        ...latestState.evidence.artifactRefs,
        ...latestState.evidence.logRefs,
        ...latestState.evidence.validationRefs
      ],
      maxStateListItems,
      12
    );
    lines.push(renderSummaryBullet('artifacts', currentArtifacts));
  }
  lines.push('');
  lines.push('## Selected Checkpoints');
  if (!includeLatestState) {
    lines.push('- skipped (includeLatestState=false)');
  } else if (recentCheckpoints.length === 0) {
    lines.push('- none');
  } else {
    for (const checkpoint of recentCheckpoints) {
      lines.push(`- ${summarizeCheckpoint(checkpoint)}`);
    }
  }
  lines.push('');
  lines.push('## Verification Expectations');
  const fastCommands = Array.isArray(validationPolicy.fastIteration) ? validationPolicy.fastIteration : [];
  const fullCommands = Array.isArray(validationPolicy.fullGate) ? validationPolicy.fullGate : [];
  lines.push(`- fast: ${fastCommands.length > 0 ? fastCommands.join(' ; ') : 'none configured'}`);
  lines.push(`- full: ${fullCommands.length > 0 ? fullCommands.join(' ; ') : 'none configured'}`);
  lines.push('');
  lines.push('## Selected Evidence');
  if (!includeRecentEvidence) {
    lines.push('- skipped (includeRecentEvidence=false)');
  } else if (evidenceReferences.length === 0) {
    lines.push('- none');
  } else {
    for (const entry of evidenceReferences) {
      lines.push(`- ${entry}`);
    }
  }
  lines.push('');
  lines.push('## Contact Boundaries');
  lines.push('- Use this pack as the primary context for this role session.');
  lines.push('- Expand beyond this pack only for explicit blockers tied to current scope.');
  lines.push(`- Selected continuity inputs: checkpoints=${recentCheckpoints.length}, evidence=${evidenceReferences.length}.`);
  lines.push('- Keep edits scoped to the active plan, canonical evidence, and required implementation files.');
  lines.push('');

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const rendered = `${lines.join('\n')}\n`;
  await fs.writeFile(outputPath, rendered, 'utf8');

  const outputRel = toPosix(path.relative(rootDir, outputPath));
  return {
    outputPath: outputRel,
    bytes: Buffer.byteLength(rendered, 'utf8'),
    lineCount: lines.length,
    policyRuleCount: renderedRules.length,
    evidenceCount: evidenceReferences.length,
    checkpointCount: recentCheckpoints.length
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await compileTaskContactPack({
    rootDir: options['root-dir'] ?? process.cwd(),
    planId: options['plan-id'],
    planFile: options['plan-file'],
    role: options.role,
    declaredRiskTier: options['declared-risk-tier'],
    effectiveRiskTier: options['effective-risk-tier'],
    stageIndex: options['stage-index'],
    stageTotal: options['stage-total'],
    outputPath: options.output,
    policyPath: options.policy,
    configPath: options.config,
    runtimeContextPath: options['runtime-context-path'],
    maxPolicyBullets: options['max-policy-bullets'],
    includeRecentEvidence: options['include-recent-evidence'],
    maxRecentEvidenceItems: options['max-recent-evidence-items'],
    includeLatestState: options['include-latest-state'],
    maxRecentCheckpointItems: options['max-recent-checkpoint-items'],
    maxStateListItems: options['max-state-list-items']
  });
  console.log(
    `[contact-pack] wrote ${result.outputPath} (rules=${result.policyRuleCount}, checkpoints=${result.checkpointCount}, evidence=${result.evidenceCount}, bytes=${result.bytes}).`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[contact-pack] failed.');
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
