import type {
  ExecutionPlan,
  ExecutionStep,
  PipelineDefinition,
  StepGroup,
  SourceRequirement,
  CacheStrategy,
} from '@eve-fabric/domain';

function collectNeededStepIds(
  plan: ExecutionPlan,
  pipeline: PipelineDefinition,
  requestedOutputs: ReadonlySet<string>,
): Set<string> {
  const needed = new Set<string>();
  const stepMap = new Map<string, ExecutionStep>();
  for (const step of plan.steps) {
    stepMap.set(step.id, step);
  }

  const seedNodeIds = new Set<string>();
  for (const output of pipeline.outputs) {
    if (requestedOutputs.has(output.name)) {
      const dotIndex = output.source.indexOf('.');
      const nodeId = dotIndex >= 0 ? output.source.slice(0, dotIndex) : output.source;
      seedNodeIds.add(nodeId);
    }
  }

  const queue = [...seedNodeIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (needed.has(id)) continue;
    needed.add(id);
    const step = stepMap.get(id);
    if (step !== undefined) {
      for (const dep of step.dependsOn) {
        if (!needed.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  return needed;
}

export function prunePlan(
  plan: ExecutionPlan,
  pipeline: PipelineDefinition,
  requestedOutputs: ReadonlySet<string>,
): ExecutionPlan {
  const needed = collectNeededStepIds(plan, pipeline, requestedOutputs);

  if (needed.size === plan.steps.length) {
    return plan;
  }

  const steps = plan.steps.filter((s) => needed.has(s.id));

  const parallelGroups: StepGroup[] = [];
  for (const group of plan.parallelGroups) {
    const filteredSteps = group.steps.filter((id) => needed.has(id));
    if (filteredSteps.length > 1) {
      parallelGroups.push({ steps: filteredSteps, canParallelize: group.canParallelize });
    }
  }

  const neededCapabilityIds = new Set<string>();
  for (const step of steps) {
    neededCapabilityIds.add(step.capability.id);
  }

  const sourceRequirements: SourceRequirement[] = [];
  for (const req of plan.sourceRequirements) {
    const filteredCaps = req.capabilities.filter((c) => neededCapabilityIds.has(c.id));
    if (filteredCaps.length > 0) {
      sourceRequirements.push({ source: req.source, capabilities: filteredCaps });
    }
  }

  const cacheStrategy: CacheStrategy[] = plan.cacheStrategy.filter((cs) => needed.has(cs.stepId));

  const totalSteps = plan.steps.length;
  const ratio = totalSteps > 0 ? steps.length / totalSteps : 0;

  let esiCallCount = 0;
  for (const req of sourceRequirements) {
    if (req.source === 'ESI') {
      esiCallCount += req.capabilities.length;
    }
  }

  return {
    id: plan.id,
    pipelineRef: plan.pipelineRef,
    steps,
    parallelGroups,
    sourceRequirements,
    authRequirements: plan.authRequirements,
    cacheStrategy,
    costEstimate: {
      totalLatencyMs: Math.round(plan.costEstimate.totalLatencyMs * ratio),
      esiCallCount,
      parallelLatencyMs: Math.round(plan.costEstimate.parallelLatencyMs * ratio),
    },
    createdAt: plan.createdAt,
  };
}
