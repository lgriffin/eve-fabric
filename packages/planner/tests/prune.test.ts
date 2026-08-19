import { describe, it, expect } from 'vitest';
import { prunePlan } from '../src/prune.js';
import type {
  ExecutionPlan,
  ExecutionStep,
  PipelineDefinition,
} from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';

function makeStep(overrides: Partial<ExecutionStep> & { id: string; capId: string }): ExecutionStep {
  return {
    id: overrides.id,
    capability: {
      id: capabilityId(overrides.capId),
      version: capabilityVersion(1),
    },
    inputs: overrides.inputs ?? [],
    dependsOn: overrides.dependsOn ?? [],
    canParallelize: overrides.canParallelize ?? true,
    cacheKey: overrides.cacheKey,
  };
}

function makePlan(steps: ExecutionStep[], extras?: Partial<ExecutionPlan>): ExecutionPlan {
  return {
    id: 'test-plan',
    pipelineRef: { id: 'test', version: 1 },
    steps,
    parallelGroups: extras?.parallelGroups ?? [],
    sourceRequirements: extras?.sourceRequirements ?? [],
    authRequirements: { required: false, scopes: [] },
    cacheStrategy: extras?.cacheStrategy ?? [],
    costEstimate: extras?.costEstimate ?? {
      totalLatencyMs: 1000,
      esiCallCount: 3,
      parallelLatencyMs: 500,
    },
    createdAt: new Date('2026-01-01'),
  };
}

function makePipeline(outputs: Array<{ name: string; source: string }>): PipelineDefinition {
  return {
    id: 'test-pipeline',
    version: 1,
    name: 'Test Pipeline',
    inputs: [],
    nodes: [],
    edges: [],
    outputs: outputs.map((o) => ({ name: o.name, source: o.source })),
  };
}

describe('prunePlan', () => {
  it('returns full plan when all outputs are requested', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'cap.one' }),
      makeStep({ id: 'b', capId: 'cap.two', dependsOn: ['a'] }),
    ];
    const plan = makePlan(steps);
    const pipeline = makePipeline([
      { name: 'out1', source: 'a.result' },
      { name: 'out2', source: 'b.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set(['out1', 'out2']));

    expect(pruned.steps).toHaveLength(2);
    expect(pruned).toBe(plan);
  });

  it('removes steps not needed by selection', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'cap.one' }),
      makeStep({ id: 'b', capId: 'cap.two' }),
    ];
    const plan = makePlan(steps);
    const pipeline = makePipeline([
      { name: 'out1', source: 'a.result' },
      { name: 'out2', source: 'b.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set(['out1']));

    expect(pruned.steps).toHaveLength(1);
    expect(pruned.steps[0]!.id).toBe('a');
  });

  it('preserves transitive dependencies', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'cap.one' }),
      makeStep({ id: 'b', capId: 'cap.two', dependsOn: ['a'] }),
      makeStep({ id: 'c', capId: 'cap.three', dependsOn: ['b'] }),
      makeStep({ id: 'd', capId: 'cap.four' }),
    ];
    const plan = makePlan(steps);
    const pipeline = makePipeline([
      { name: 'final', source: 'c.result' },
      { name: 'other', source: 'd.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set(['final']));

    expect(pruned.steps).toHaveLength(3);
    const ids = pruned.steps.map((s) => s.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(ids).not.toContain('d');
  });

  it('updates parallel groups — removes pruned steps, drops empty groups', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'cap.one' }),
      makeStep({ id: 'b', capId: 'cap.two' }),
      makeStep({ id: 'c', capId: 'cap.three' }),
    ];
    const plan = makePlan(steps, {
      parallelGroups: [
        { steps: ['a', 'b', 'c'], canParallelize: true },
      ],
    });
    const pipeline = makePipeline([
      { name: 'out1', source: 'a.result' },
      { name: 'out2', source: 'b.result' },
      { name: 'out3', source: 'c.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set(['out1', 'out2']));

    expect(pruned.parallelGroups).toHaveLength(1);
    expect(pruned.parallelGroups[0]!.steps).toEqual(['a', 'b']);
  });

  it('drops parallel group entirely when only one step remains', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'cap.one' }),
      makeStep({ id: 'b', capId: 'cap.two' }),
    ];
    const plan = makePlan(steps, {
      parallelGroups: [{ steps: ['a', 'b'], canParallelize: true }],
    });
    const pipeline = makePipeline([
      { name: 'out1', source: 'a.result' },
      { name: 'out2', source: 'b.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set(['out1']));

    expect(pruned.parallelGroups).toHaveLength(0);
  });

  it('updates source requirements — removes pruned capabilities', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'market.orders' }),
      makeStep({ id: 'b', capId: 'universe.resolve.type' }),
    ];
    const plan = makePlan(steps, {
      sourceRequirements: [
        {
          source: 'ESI',
          capabilities: [
            { id: capabilityId('market.orders'), version: capabilityVersion(1) },
          ],
        },
        {
          source: 'SDE',
          capabilities: [
            { id: capabilityId('universe.resolve.type'), version: capabilityVersion(1) },
          ],
        },
      ],
    });
    const pipeline = makePipeline([
      { name: 'orders', source: 'a.result' },
      { name: 'type', source: 'b.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set(['orders']));

    expect(pruned.sourceRequirements).toHaveLength(1);
    expect(pruned.sourceRequirements[0]!.source).toBe('ESI');
  });

  it('updates cache strategy', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'cap.one', cacheKey: 'cache-a' }),
      makeStep({ id: 'b', capId: 'cap.two', cacheKey: 'cache-b' }),
    ];
    const plan = makePlan(steps, {
      cacheStrategy: [
        { stepId: 'a', cacheable: true, ttlSeconds: 300, identityInKey: false },
        { stepId: 'b', cacheable: true, ttlSeconds: 600, identityInKey: true },
      ],
    });
    const pipeline = makePipeline([
      { name: 'out1', source: 'a.result' },
      { name: 'out2', source: 'b.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set(['out1']));

    expect(pruned.cacheStrategy).toHaveLength(1);
    expect(pruned.cacheStrategy[0]!.stepId).toBe('a');
  });

  it('returns plan with no steps when requestedOutputs is empty', () => {
    const steps = [
      makeStep({ id: 'a', capId: 'cap.one' }),
      makeStep({ id: 'b', capId: 'cap.two' }),
    ];
    const plan = makePlan(steps);
    const pipeline = makePipeline([
      { name: 'out1', source: 'a.result' },
      { name: 'out2', source: 'b.result' },
    ]);

    const pruned = prunePlan(plan, pipeline, new Set());

    expect(pruned.steps).toHaveLength(0);
    expect(pruned.costEstimate.totalLatencyMs).toBe(0);
    expect(pruned.costEstimate.esiCallCount).toBe(0);
  });
});
