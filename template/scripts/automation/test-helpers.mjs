import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const templateRoot = path.join(repoRoot, 'template');

export async function createTemplateRepo() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-flat-queue-'));
  await fs.cp(templateRoot, tempRoot, { recursive: true });
  const fragment = JSON.parse(await fs.readFile(path.join(tempRoot, 'package.scripts.fragment.json'), 'utf8'));
  const packageJson = {
    name: 'flat-queue-fixture',
    private: true,
    version: '0.0.0-test',
    type: 'module',
    engines: {
      node: '>=24 <25'
    },
    scripts: fragment.scripts
  };
  await fs.writeFile(path.join(tempRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  const gitInit = spawnSync('git', ['init'], { cwd: tempRoot, stdio: 'pipe' });
  if (gitInit.status !== 0) {
    throw new Error(String(gitInit.stderr ?? gitInit.stdout ?? 'git init failed'));
  }
  spawnSync('git', ['config', 'user.name', 'Harness Fixture'], { cwd: tempRoot, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.email', 'harness-fixture@example.com'], { cwd: tempRoot, stdio: 'pipe' });
  const gitAdd = spawnSync('git', ['add', '.'], { cwd: tempRoot, stdio: 'pipe' });
  if (gitAdd.status !== 0) {
    throw new Error(String(gitAdd.stderr ?? gitAdd.stdout ?? 'git add failed'));
  }
  const gitCommit = spawnSync('git', ['commit', '-m', 'chore: seed fixture'], { cwd: tempRoot, stdio: 'pipe' });
  if (gitCommit.status !== 0) {
    throw new Error(String(gitCommit.stderr ?? gitCommit.stdout ?? 'git commit failed'));
  }
  return tempRoot;
}

export function runNode(scriptPath, args = [], cwd = repoRoot, env = {}) {
  return spawnSync('node', [scriptPath, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'pipe'
  });
}

export async function loadJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}
