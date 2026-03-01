#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_AGENTS_PATH = 'AGENTS.md';
const DEFAULT_POLICY_PATH = 'docs/governance/policy-manifest.json';
const DEFAULT_CONFIG_PATH = 'docs/ops/automation/orchestrator.config.json';
const DEFAULT_REPORT_PATH = 'docs/generated/github-agent-export.json';
const DEFAULT_PROFILES_DIR = '.github/agents';

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
  return value.split(path.sep).join('/');
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${toPosix(filePath)}: ${message}`);
  }
}

function extractDocRefs(agentsRaw) {
  const refs = new Set();
  const regex = /`(AGENTS\.md|README\.md|ARCHITECTURE\.md|docs\/[A-Za-z0-9_./-]+\.(?:md|json|ya?ml))`/g;
  for (const match of agentsRaw.matchAll(regex)) {
    refs.add(match[1]);
  }
  return [...refs].sort((a, b) => a.localeCompare(b));
}

function normalizeRoleProfiles(config) {
  const source = config?.roleOrchestration?.roleProfiles ?? {};
  const result = {};
  for (const [role, profile] of Object.entries(source)) {
    if (!profile || typeof profile !== 'object') {
      continue;
    }
    result[role] = {
      model: String(profile.model ?? '').trim(),
      reasoningEffort: String(profile.reasoningEffort ?? '').trim(),
      sandboxMode: String(profile.sandboxMode ?? '').trim(),
      instructions: String(profile.instructions ?? '').trim()
    };
  }
  return result;
}

function normalizePipelines(config) {
  const pipelines = config?.roleOrchestration?.pipelines ?? {};
  return {
    low: Array.isArray(pipelines.low) ? pipelines.low : ['worker'],
    medium: Array.isArray(pipelines.medium) ? pipelines.medium : ['planner', 'worker', 'reviewer'],
    high: Array.isArray(pipelines.high) ? pipelines.high : ['planner', 'explorer', 'worker', 'reviewer']
  };
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();

  const agentsPath = path.resolve(rootDir, String(options.agents ?? DEFAULT_AGENTS_PATH));
  const policyPath = path.resolve(rootDir, String(options.policy ?? DEFAULT_POLICY_PATH));
  const configPath = path.resolve(rootDir, String(options.config ?? DEFAULT_CONFIG_PATH));
  const reportPath = path.resolve(rootDir, String(options.output ?? DEFAULT_REPORT_PATH));
  const profilesDir = path.resolve(rootDir, String(options['profiles-dir'] ?? DEFAULT_PROFILES_DIR));

  const writeProfiles = parseBoolean(options['write-profiles'], false);
  const dryRun = parseBoolean(options['dry-run'], !writeProfiles);
  const shouldWriteProfiles = writeProfiles && !dryRun;

  const [agentsRaw, policyManifest, orchestratorConfig] = await Promise.all([
    fs.readFile(agentsPath, 'utf8'),
    readJson(policyPath),
    readJson(configPath)
  ]);

  const roleProfiles = normalizeRoleProfiles(orchestratorConfig);
  const riskPipelines = normalizePipelines(orchestratorConfig);
  const mandatorySafetyRules = Array.isArray(policyManifest?.mandatorySafetyRules)
    ? policyManifest.mandatorySafetyRules.map((rule) => ({
        id: String(rule.id ?? '').trim(),
        statement: String(rule.statement ?? '').trim(),
        requiredInRuntimeContext: Boolean(rule.requiredInRuntimeContext)
      }))
    : [];

  const canonicalEntrypoints = Array.isArray(policyManifest?.docContract?.canonicalEntryPoints)
    ? policyManifest.docContract.canonicalEntryPoints
    : [];

  const extractedEntrypoints = extractDocRefs(agentsRaw);

  const basePolicy = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      policyManifest: toPosix(path.relative(rootDir, policyPath)),
      agents: toPosix(path.relative(rootDir, agentsPath))
    },
    mandatorySafetyRules,
    docContract: policyManifest?.docContract ?? {},
    gitSafetyContract: policyManifest?.gitSafetyContract ?? {}
  };

  const roleProfilesPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      orchestratorConfig: toPosix(path.relative(rootDir, configPath))
    },
    roleProfiles,
    provider: String(orchestratorConfig?.executor?.provider ?? 'codex').trim().toLowerCase()
  };

  const riskPipelinesPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      orchestratorConfig: toPosix(path.relative(rootDir, configPath))
    },
    pipelines: riskPipelines,
    riskModel: orchestratorConfig?.roleOrchestration?.riskModel ?? {},
    approvalGates: orchestratorConfig?.roleOrchestration?.approvalGates ?? {},
    validation: orchestratorConfig?.validation ?? {}
  };

  const exportFiles = [
    {
      path: path.join(profilesDir, 'base-policy.json'),
      relPath: toPosix(path.relative(rootDir, path.join(profilesDir, 'base-policy.json'))),
      payload: basePolicy
    },
    {
      path: path.join(profilesDir, 'role-profiles.json'),
      relPath: toPosix(path.relative(rootDir, path.join(profilesDir, 'role-profiles.json'))),
      payload: roleProfilesPayload
    },
    {
      path: path.join(profilesDir, 'risk-pipelines.json'),
      relPath: toPosix(path.relative(rootDir, path.join(profilesDir, 'risk-pipelines.json'))),
      payload: riskPipelinesPayload
    }
  ];

  if (shouldWriteProfiles) {
    for (const file of exportFiles) {
      await writeJson(file.path, file.payload);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: {
      dryRun,
      writeProfilesRequested: writeProfiles,
      wroteProfiles: shouldWriteProfiles
    },
    inputs: {
      agents: toPosix(path.relative(rootDir, agentsPath)),
      policyManifest: toPosix(path.relative(rootDir, policyPath)),
      orchestratorConfig: toPosix(path.relative(rootDir, configPath))
    },
    mapping: {
      safetyPolicy: 'policy-manifest.mandatorySafetyRules -> base-policy.json',
      roleProfiles: 'roleOrchestration.roleProfiles -> role-profiles.json',
      riskRouting: 'roleOrchestration.pipelines -> risk-pipelines.json',
      validationLanes: 'validation -> risk-pipelines.json',
      canonicalEntrypoints: {
        fromPolicyManifest: canonicalEntrypoints,
        discoveredFromAgentsMd: extractedEntrypoints
      }
    },
    files: exportFiles.map((file) => ({
      path: file.relPath,
      status: shouldWriteProfiles ? 'written' : 'preview-only'
    })),
    notes: [
      'This export is a scaffold and may require platform-specific schema adjustments.',
      'Blueprint governance remains canonical; exported files should be treated as derived artifacts.'
    ]
  };

  await writeJson(reportPath, report);

  console.log(
    `[github-interop-export] wrote ${toPosix(path.relative(rootDir, reportPath))} (dryRun=${dryRun}, wroteProfiles=${shouldWriteProfiles}).`
  );
}

main().catch((error) => {
  console.error('[github-interop-export] failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
