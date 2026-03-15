import path from 'node:path';

const TRANSIENT_AUTOMATION_FILES = new Set([
  'docs/ops/automation/run-state.json',
  'docs/ops/automation/run-events.jsonl'
]);

const TRANSIENT_AUTOMATION_DIR_PREFIXES = [
  'docs/ops/automation/runtime/',
  'docs/ops/automation/handoffs/'
];

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function classifyTouchedPath(filePath) {
  const value = toPosix(String(filePath ?? '').trim()).replace(/^\.?\//, '');
  const baseName = path.posix.basename(value).toLowerCase();

  if (value.startsWith('docs/exec-plans/')) {
    return 'plan-docs';
  }
  if (value.startsWith('docs/ops/automation/')) {
    return 'automation';
  }
  if (value.startsWith('docs/')) {
    return 'docs';
  }
  if (baseName.endsWith('.md') || baseName.endsWith('.mdx')) {
    return 'docs';
  }
  if (
    baseName.endsWith('.spec.ts') ||
    baseName.endsWith('.spec.tsx') ||
    baseName.endsWith('.spec.js') ||
    baseName.endsWith('.spec.jsx') ||
    baseName.endsWith('.test.ts') ||
    baseName.endsWith('.test.tsx') ||
    baseName.endsWith('.test.js') ||
    baseName.endsWith('.test.jsx') ||
    value.includes('/__tests__/') ||
    value.includes('/tests/') ||
    value.includes('/test/') ||
    value.includes('/e2e/')
  ) {
    return 'tests';
  }
  if (
    baseName === 'package-lock.json' ||
    baseName === 'pnpm-lock.yaml' ||
    baseName === 'yarn.lock' ||
    baseName === 'bun.lockb'
  ) {
    return 'lockfiles';
  }
  if (
    baseName === 'package.json' ||
    baseName === 'tsconfig.json' ||
    baseName === 'tsconfig.base.json' ||
    baseName === 'turbo.json' ||
    baseName === 'components.json' ||
    baseName === 'biome.json' ||
    baseName === 'biome.jsonc' ||
    baseName === 'eslint.config.js' ||
    baseName === 'eslint.config.mjs' ||
    baseName === 'eslint.config.cjs' ||
    baseName === 'eslint.config.ts' ||
    baseName === 'vitest.config.js' ||
    baseName === 'vitest.config.mjs' ||
    baseName === 'vitest.config.cjs' ||
    baseName === 'vitest.config.ts' ||
    baseName === 'jest.config.js' ||
    baseName === 'jest.config.mjs' ||
    baseName === 'jest.config.cjs' ||
    baseName === 'jest.config.ts' ||
    baseName === 'playwright.config.js' ||
    baseName === 'playwright.config.mjs' ||
    baseName === 'playwright.config.cjs' ||
    baseName === 'playwright.config.ts' ||
    baseName === 'vite.config.js' ||
    baseName === 'vite.config.mjs' ||
    baseName === 'vite.config.cjs' ||
    baseName === 'vite.config.ts' ||
    baseName === 'next.config.js' ||
    baseName === 'next.config.mjs' ||
    baseName === 'next.config.cjs' ||
    baseName === 'next.config.ts' ||
    baseName === 'tailwind.config.js' ||
    baseName === 'tailwind.config.mjs' ||
    baseName === 'tailwind.config.cjs' ||
    baseName === 'tailwind.config.ts'
  ) {
    return 'configs';
  }
  if (
    value.includes('/scripts/') ||
    value.startsWith('scripts/') ||
    baseName.endsWith('.sh') ||
    baseName.endsWith('.bash') ||
    baseName.endsWith('.zsh') ||
    baseName.endsWith('.ps1') ||
    baseName.endsWith('.mjs') ||
    baseName.endsWith('.cjs')
  ) {
    return 'scripts';
  }
  return 'source';
}

function normalizeRelativePrefixList(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((entry) => toPosix(String(entry ?? '').trim()).replace(/^\.?\//, '').replace(/\/+$/, ''))
      .filter(Boolean)
  )];
}

export function normalizeTouchedPathList(paths = []) {
  return [...new Set(
    (Array.isArray(paths) ? paths : [])
      .map((entry) => toPosix(String(entry ?? '').trim()).replace(/^\.?\//, ''))
      .filter(Boolean)
  )];
}

export function isTransientAutomationPath(pathValue) {
  const normalized = toPosix(String(pathValue ?? '').trim()).replace(/^\.?\//, '');
  if (!normalized) {
    return false;
  }
  if (TRANSIENT_AUTOMATION_FILES.has(normalized)) {
    return true;
  }
  return TRANSIENT_AUTOMATION_DIR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function pathMatchesRootPrefix(filePath, rootPrefix) {
  const normalizedFile = toPosix(String(filePath ?? '').trim()).replace(/^\.?\//, '');
  const normalizedRoot = toPosix(String(rootPrefix ?? '').trim()).replace(/^\.?\//, '').replace(/\/+$/, '');
  if (!normalizedFile || !normalizedRoot) {
    return false;
  }
  return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}/`);
}

export function implementationTargetRoots(plan, options = {}) {
  const implementationTargets = Array.isArray(plan?.implementationTargets) ? plan.implementationTargets : [];
  const sourceOnly = options && options.sourceOnly === true;
  return [...new Set(
    implementationTargets
      .map((entry) => toPosix(String(entry ?? '').trim()).replace(/^\.?\//, '').replace(/\/+$/, ''))
      .filter(Boolean)
      .filter((entry) => {
        const category = classifyTouchedPath(entry);
        if (
          category !== 'source' &&
          category !== 'tests' &&
          category !== 'scripts' &&
          category !== 'configs' &&
          category !== 'lockfiles'
        ) {
          return false;
        }
        return sourceOnly ? category === 'source' : true;
      })
  )];
}

export function disallowedWorkerTouchedPaths(plan, touchedPaths = []) {
  const normalizedPaths = normalizeTouchedPathList(touchedPaths);
  const allowedRoots = implementationTargetRoots(plan);
  if (allowedRoots.length === 0) {
    return [];
  }

  return normalizedPaths.filter((filePath) => {
    if (filePath.startsWith('docs/exec-plans/')) {
      return false;
    }
    if (isTransientAutomationPath(filePath)) {
      return false;
    }
    return !allowedRoots.some((root) => pathMatchesRootPrefix(filePath, root));
  });
}
