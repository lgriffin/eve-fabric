import { describe, it, expect } from 'vitest';
import { deduplicateSteps } from '../src/deduplicate.js';
import type { ExecutionStep } from '@eve-fabric/domain';

function makeStep(overrides: Partial<ExecutionStep> & { id: string }): ExecutionStep {
  return {
    capability: { id: 'cap.a' },
    inputs: [],
    dependsOn: [],
    canParallelize: true,
    ...overrides,
  };
}

describe('deduplicateSteps', () => {
  it('returns original steps when no duplicates exist', () => {
    const steps: ExecutionStep[] = [
      makeStep({ id: 'step1', capability: { id: 'cap.a' } }),
      makeStep({ id: 'step2', capability: { id: 'cap.b' } }),
    ];
    const result = deduplicateSteps(steps);
    expect(result.mergedCount).toBe(0);
    expect(result.steps).toHaveLength(2);
  });

  it('merges steps with identical capability and inputs', () => {
    const steps: ExecutionStep[] = [
      makeStep({
        id: 'step1',
        capability: { id: 'cap.a', version: '1.0.0' },
        inputs: [{ portName: 'x', source: 'pipeline-input', pipelineInputName: 'region' }],
      }),
      makeStep({
        id: 'step2',
        capability: { id: 'cap.a', version: '1.0.0' },
        inputs: [{ portName: 'x', source: 'pipeline-input', pipelineInputName: 'region' }],
      }),
    ];
    const result = deduplicateSteps(steps);
    expect(result.mergedCount).toBe(1);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.id).toBe('step1');
  });

  it('rewires dependsOn references to merged step', () => {
    const steps: ExecutionStep[] = [
      makeStep({
        id: 'step1',
        capability: { id: 'cap.a', version: '1.0.0' },
      }),
      makeStep({
        id: 'step2',
        capability: { id: 'cap.a', version: '1.0.0' },
      }),
      makeStep({
        id: 'step3',
        capability: { id: 'cap.b' },
        dependsOn: ['step2'],
      }),
    ];
    const result = deduplicateSteps(steps);
    expect(result.mergedCount).toBe(1);
    const step3 = result.steps.find((s) => s.id === 'step3');
    expect(step3!.dependsOn).toEqual(['step1']);
  });

  it('rewires step-output input bindings to merged step', () => {
    const steps: ExecutionStep[] = [
      makeStep({
        id: 'step1',
        capability: { id: 'cap.a', version: '1.0.0' },
      }),
      makeStep({
        id: 'step2',
        capability: { id: 'cap.a', version: '1.0.0' },
      }),
      makeStep({
        id: 'step3',
        capability: { id: 'cap.b' },
        inputs: [
          { portName: 'data', source: 'step-output', stepId: 'step2', outputPortName: 'out' },
        ],
      }),
    ];
    const result = deduplicateSteps(steps);
    const step3 = result.steps.find((s) => s.id === 'step3');
    expect(step3!.inputs[0]!.stepId).toBe('step1');
  });

  it('does not merge steps with different versions', () => {
    const steps: ExecutionStep[] = [
      makeStep({ id: 'step1', capability: { id: 'cap.a', version: '1.0.0' } }),
      makeStep({ id: 'step2', capability: { id: 'cap.a', version: '2.0.0' } }),
    ];
    const result = deduplicateSteps(steps);
    expect(result.mergedCount).toBe(0);
    expect(result.steps).toHaveLength(2);
  });

  it('does not merge steps with different input sources', () => {
    const steps: ExecutionStep[] = [
      makeStep({
        id: 'step1',
        capability: { id: 'cap.a' },
        inputs: [{ portName: 'x', source: 'pipeline-input', pipelineInputName: 'region1' }],
      }),
      makeStep({
        id: 'step2',
        capability: { id: 'cap.a' },
        inputs: [{ portName: 'x', source: 'pipeline-input', pipelineInputName: 'region2' }],
      }),
    ];
    const result = deduplicateSteps(steps);
    expect(result.mergedCount).toBe(0);
    expect(result.steps).toHaveLength(2);
  });
});
