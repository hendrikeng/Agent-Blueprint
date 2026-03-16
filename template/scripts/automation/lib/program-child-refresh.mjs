import { compileProgramChildren } from './program-child-compiler.mjs';

function normalizePlanId(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function parentScopeIdsForPlan(plan) {
  const parentIds = new Set();
  const executionScope = String(plan?.executionScope ?? '').trim().toLowerCase();
  const planId = normalizePlanId(plan?.planId);
  const parentPlanId = normalizePlanId(plan?.parentPlanId);

  if (executionScope === 'program' && planId) {
    parentIds.add(planId);
  }
  if (parentPlanId) {
    parentIds.add(parentPlanId);
  }

  return [...parentIds].sort((left, right) => left.localeCompare(right));
}

export async function recompileProgramChildrenForParentScopes(rootDir, parentIds, options = {}) {
  const uniqueParentIds = [...new Set((Array.isArray(parentIds) ? parentIds : []).map(normalizePlanId).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const result = {
    parentIds: uniqueParentIds,
    advisories: [],
    writes: [],
    moves: [],
    issues: [],
    parentOutcomes: []
  };

  for (const parentId of uniqueParentIds) {
    const compileResult = await compileProgramChildren(rootDir, {
      write: options.write !== false,
      dryRun: options.dryRun === true,
      planId: parentId
    });
    result.advisories.push(...(compileResult.advisories ?? []));
    result.writes.push(...(compileResult.writes ?? []));
    result.moves.push(...(compileResult.moves ?? []));
    result.issues.push(...(compileResult.issues ?? []));
    result.parentOutcomes.push(...(compileResult.parentOutcomes ?? []));
  }

  return result;
}
