import type { ExecutionStep } from '@eve-fabric/domain';

function stepSignature(step: ExecutionStep): string {
  const capKey = `${step.capability.id}@${step.capability.version ?? 'latest'}`;
  const inputSources = step.inputs
    .map((b) => {
      if (b.source === 'pipeline-input') return `pi:${b.pipelineInputName ?? b.portName}`;
      return `so:${b.stepId ?? ''}:${b.outputPortName ?? ''}`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join(',');
  return `${capKey}|${inputSources}`;
}

export interface DeduplicationResult {
  readonly steps: readonly ExecutionStep[];
  readonly mergedCount: number;
}

export function deduplicateSteps(steps: readonly ExecutionStep[]): DeduplicationResult {
  const signatureMap = new Map<string, ExecutionStep>();
  const mergeMap = new Map<string, string>();
  const kept: ExecutionStep[] = [];

  for (const step of steps) {
    const sig = stepSignature(step);
    const existing = signatureMap.get(sig);
    if (existing) {
      mergeMap.set(step.id, existing.id);
    } else {
      signatureMap.set(sig, step);
      kept.push(step);
    }
  }

  if (mergeMap.size === 0) return { steps, mergedCount: 0 };

  const rewired = kept.map((step) => ({
    ...step,
    dependsOn: step.dependsOn.map((dep) => mergeMap.get(dep) ?? dep),
    inputs: step.inputs.map((binding) => {
      if (binding.source === 'step-output' && binding.stepId) {
        const remapped = mergeMap.get(binding.stepId);
        if (remapped) return { ...binding, stepId: remapped };
      }
      return binding;
    }),
  }));

  return { steps: rewired, mergedCount: mergeMap.size };
}
