import type { ExecutionStep } from '@eve-fabric/domain';

function stepSignature(step: ExecutionStep): string {
  const capKey = `${step.capability.id}@${step.capability.version ?? 'latest'}`;
  const inputSources = step.inputs
    .map((b) => {
      // Which port a value feeds matters: a route from A to B is not one from B to A.
      if (b.source === 'pipeline-input') {
        return `${b.portName}=pi:${b.pipelineInputName ?? b.portName}`;
      }
      return `${b.portName}=so:${b.stepId ?? ''}:${b.outputPortName ?? ''}:${(b.fieldPath ?? []).join('.')}`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join(',');
  // A step run per item is not the same step run once, nor one with another cap.
  const each = step.each === undefined ? '' : `|each:${step.each.port}:${step.each.cap}`;
  return `${capKey}|${inputSources}${each}`;
}

export interface DeduplicationResult {
  readonly steps: readonly ExecutionStep[];
  readonly mergedCount: number;
  /** Each merged step id and the kept step whose result it shares. */
  readonly aliases: ReadonlyMap<string, string>;
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

  if (mergeMap.size === 0) return { steps, mergedCount: 0, aliases: mergeMap };

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

  return { steps: rewired, mergedCount: mergeMap.size, aliases: mergeMap };
}
