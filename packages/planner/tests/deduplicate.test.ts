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

  it('does not merge steps fed the same values on different ports', () => {
    // A route from A to B is not a route from B to A.
    const steps: ExecutionStep[] = [
      makeStep({
        id: 'there',
        inputs: [
          { portName: 'origin', source: 'pipeline-input', pipelineInputName: 'a' },
          { portName: 'destination', source: 'pipeline-input', pipelineInputName: 'b' },
        ],
      }),
      makeStep({
        id: 'back',
        inputs: [
          { portName: 'origin', source: 'pipeline-input', pipelineInputName: 'b' },
          { portName: 'destination', source: 'pipeline-input', pipelineInputName: 'a' },
        ],
      }),
    ];
    expect(deduplicateSteps(steps).mergedCount).toBe(0);
  });

  it('does not merge steps reading different fields of one output', () => {
    const read = (id: string, field: string): ExecutionStep =>
      makeStep({
        id,
        inputs: [
          {
            portName: 'id',
            source: 'step-output',
            stepId: 'order',
            outputPortName: 'cheapest',
            fieldPath: [field],
          },
        ],
      });
    expect(deduplicateSteps([read('a', 'location_id'), read('b', 'system_id')]).mergedCount).toBe(
      0,
    );
    expect(deduplicateSteps([read('a', 'system_id'), read('b', 'system_id')]).mergedCount).toBe(1);
  });

  it('does not merge a step run per item with the same step run once', () => {
    const inputs: ExecutionStep['inputs'] = [
      { portName: 'id', source: 'pipeline-input', pipelineInputName: 'ids' },
    ];
    const once = makeStep({ id: 'once', inputs });
    const each = makeStep({ id: 'each', inputs, each: { port: 'id', cap: 100 } });
    expect(deduplicateSteps([once, each]).mergedCount).toBe(0);
  });

  it('does not merge per-item steps with different caps', () => {
    const inputs: ExecutionStep['inputs'] = [
      { portName: 'id', source: 'pipeline-input', pipelineInputName: 'ids' },
    ];
    const small = makeStep({ id: 'small', inputs, each: { port: 'id', cap: 2 } });
    const large = makeStep({ id: 'large', inputs, each: { port: 'id', cap: 100 } });
    expect(deduplicateSteps([small, large]).mergedCount).toBe(0);
  });
});
