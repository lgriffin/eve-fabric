import type { ExecutionPlan, ExecutionStep } from '@eve-fabric/domain';
import { deduplicateSteps } from './deduplicate.js';

export interface ParallelGroup {
  readonly stepIds: readonly string[];
}

export interface CoalescedGroup {
  readonly source: string;
  readonly stepIds: readonly string[];
}

export interface PlannedExecution {
  readonly orderedSteps: readonly string[];
  readonly parallelGroups: readonly ParallelGroup[];
  readonly coalescedRequests: readonly CoalescedGroup[];
}

/**
 * Topological sort using Kahn's algorithm (BFS-based).
 * Returns step IDs grouped by dependency level.
 */
function topologicalLevels(steps: readonly ExecutionStep[]): readonly (readonly string[])[] {
  const stepIds = new Set(steps.map((s) => s.id));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const step of steps) {
    inDegree.set(step.id, 0);
    dependents.set(step.id, []);
  }

  for (const step of steps) {
    let degree = 0;
    for (const dep of step.dependsOn) {
      if (stepIds.has(dep)) {
        degree++;
        const list = dependents.get(dep);
        if (list !== undefined) {
          list.push(step.id);
        }
      }
    }
    inDegree.set(step.id, degree);
  }

  const levels: string[][] = [];
  let queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    levels.push([...queue]);
    const nextQueue: string[] = [];

    for (const id of queue) {
      const deps = dependents.get(id);
      if (deps !== undefined) {
        for (const dep of deps) {
          const current = inDegree.get(dep);
          if (current !== undefined) {
            const newDeg = current - 1;
            inDegree.set(dep, newDeg);
            if (newDeg === 0) {
              nextQueue.push(dep);
            }
          }
        }
      }
    }

    queue = nextQueue;
  }

  // Verify all steps were visited (detect cycles)
  const visited = levels.reduce((sum, level) => sum + level.length, 0);
  if (visited !== steps.length) {
    throw new Error(
      `Cycle detected in execution plan: only ${String(visited)} of ${String(steps.length)} steps could be ordered`,
    );
  }

  return levels;
}

/**
 * Build parallel groups from topological levels.
 * Steps within the same level that have canParallelize=true
 * are grouped together.
 */
function buildParallelGroups(
  steps: readonly ExecutionStep[],
  levels: readonly (readonly string[])[],
): readonly ParallelGroup[] {
  const stepMap = new Map<string, ExecutionStep>();
  for (const step of steps) {
    stepMap.set(step.id, step);
  }

  const groups: ParallelGroup[] = [];

  for (const level of levels) {
    const parallelizable: string[] = [];
    for (const id of level) {
      const step = stepMap.get(id);
      if (step !== undefined && step.canParallelize) {
        parallelizable.push(id);
      }
    }
    if (parallelizable.length > 1) {
      groups.push({ stepIds: parallelizable });
    }
  }

  return groups;
}

/**
 * Coalesce steps that target the same data source so they can
 * potentially be batched.
 */
function buildCoalescedGroups(
  plan: ExecutionPlan,
  steps: readonly ExecutionStep[],
): readonly CoalescedGroup[] {
  const capabilityToSource = new Map<string, string>();

  for (const req of plan.sourceRequirements) {
    for (const cap of req.capabilities) {
      capabilityToSource.set(cap.id, req.source);
    }
  }

  const sourceToSteps = new Map<string, string[]>();

  for (const step of steps) {
    const source = capabilityToSource.get(step.capability.id);
    if (source !== undefined) {
      let list = sourceToSteps.get(source);
      if (list === undefined) {
        list = [];
        sourceToSteps.set(source, list);
      }
      list.push(step.id);
    }
  }

  const groups: CoalescedGroup[] = [];
  for (const [source, stepIds] of sourceToSteps) {
    if (stepIds.length > 0) {
      groups.push({ source, stepIds });
    }
  }

  return groups;
}

/**
 * Takes a compiled ExecutionPlan and produces an optimized PlannedExecution
 * with dependency-ordered steps, parallel groups, and coalesced requests.
 */
export function planExecution(plan: ExecutionPlan): PlannedExecution {
  const { steps: dedupedSteps } = deduplicateSteps(plan.steps);
  const levels = topologicalLevels(dedupedSteps);

  const orderedSteps: string[] = [];
  for (const level of levels) {
    for (const id of level) {
      orderedSteps.push(id);
    }
  }

  const parallelGroups = buildParallelGroups(dedupedSteps, levels);
  const coalescedRequests = buildCoalescedGroups(plan, dedupedSteps);

  return {
    orderedSteps,
    parallelGroups,
    coalescedRequests,
  };
}
