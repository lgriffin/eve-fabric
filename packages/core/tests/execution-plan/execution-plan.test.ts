import { describe, it, expect } from 'vitest';
import type {
  InputBinding,
  ExecutionStep,
  StepGroup,
  SourceRequirement,
  CacheStrategy,
  CostEstimate,
  ExecutionPlan,
} from '../../src/execution-plan/execution-plan.js';
import { capabilityId, capabilityVersion } from '../../src/capability/capability-id.js';

describe('InputBinding', () => {
  it('represents a pipeline-input binding', () => {
    const binding: InputBinding = {
      portName: 'regionId',
      source: 'pipeline-input',
      pipelineInputName: 'region',
    };
    expect(binding.portName).toBe('regionId');
    expect(binding.source).toBe('pipeline-input');
    expect(binding.pipelineInputName).toBe('region');
    expect(binding.stepId).toBeUndefined();
    expect(binding.outputPortName).toBeUndefined();
  });

  it('represents a step-output binding', () => {
    const binding: InputBinding = {
      portName: 'typeIds',
      source: 'step-output',
      stepId: 'step-1',
      outputPortName: 'ids',
    };
    expect(binding.source).toBe('step-output');
    expect(binding.stepId).toBe('step-1');
    expect(binding.outputPortName).toBe('ids');
  });
});

describe('ExecutionStep', () => {
  it('has required fields and optional cacheKey', () => {
    const step: ExecutionStep = {
      id: 'step-1',
      capability: { id: capabilityId('market.orders') },
      inputs: [],
      dependsOn: [],
      canParallelize: true,
    };
    expect(step.id).toBe('step-1');
    expect(step.canParallelize).toBe(true);
    expect(step.cacheKey).toBeUndefined();
  });

  it('accepts a cacheKey', () => {
    const step: ExecutionStep = {
      id: 'step-2',
      capability: { id: capabilityId('market.orders'), version: capabilityVersion(1) },
      inputs: [],
      dependsOn: ['step-1'],
      cacheKey: 'market.orders:region=10000002',
      canParallelize: false,
    };
    expect(step.cacheKey).toBe('market.orders:region=10000002');
    expect(step.dependsOn).toEqual(['step-1']);
  });
});

describe('StepGroup', () => {
  it('groups steps with parallelization flag', () => {
    const group: StepGroup = {
      steps: ['step-1', 'step-2'],
      canParallelize: true,
    };
    expect(group.steps).toHaveLength(2);
    expect(group.canParallelize).toBe(true);
  });
});

describe('SourceRequirement', () => {
  it('maps a source to required capabilities', () => {
    const req: SourceRequirement = {
      source: 'ESI',
      capabilities: [{ id: capabilityId('market.orders') }],
    };
    expect(req.source).toBe('ESI');
    expect(req.capabilities).toHaveLength(1);
  });
});

describe('CacheStrategy', () => {
  it('defines caching for a step', () => {
    const strategy: CacheStrategy = {
      stepId: 'step-1',
      cacheable: true,
      ttlSeconds: 300,
      identityInKey: false,
    };
    expect(strategy.cacheable).toBe(true);
    expect(strategy.ttlSeconds).toBe(300);
    expect(strategy.identityInKey).toBe(false);
  });
});

describe('CostEstimate', () => {
  it('holds latency and call count', () => {
    const cost: CostEstimate = {
      totalLatencyMs: 500,
      esiCallCount: 3,
      parallelLatencyMs: 200,
    };
    expect(cost.totalLatencyMs).toBe(500);
    expect(cost.parallelLatencyMs).toBe(200);
  });
});

describe('ExecutionPlan', () => {
  it('composes all sub-interfaces into a plan', () => {
    const plan: ExecutionPlan = {
      id: 'plan-1',
      pipelineRef: { id: 'pipeline-1', version: 1 },
      steps: [
        {
          id: 'step-1',
          capability: { id: capabilityId('market.orders') },
          inputs: [
            {
              portName: 'regionId',
              source: 'pipeline-input',
              pipelineInputName: 'region',
            },
          ],
          dependsOn: [],
          canParallelize: true,
        },
      ],
      parallelGroups: [{ steps: ['step-1'], canParallelize: true }],
      sourceRequirements: [
        {
          source: 'ESI',
          capabilities: [{ id: capabilityId('market.orders') }],
        },
      ],
      authRequirements: { required: true, scopes: ['esi-markets.read_structures.v1'] },
      cacheStrategy: [{ stepId: 'step-1', cacheable: true, ttlSeconds: 300, identityInKey: false }],
      costEstimate: { totalLatencyMs: 500, esiCallCount: 1, parallelLatencyMs: 500 },
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    expect(plan.id).toBe('plan-1');
    expect(plan.pipelineRef.id).toBe('pipeline-1');
    expect(plan.pipelineRef.version).toBe(1);
    expect(plan.steps).toHaveLength(1);
    expect(plan.parallelGroups).toHaveLength(1);
    expect(plan.sourceRequirements).toHaveLength(1);
    expect(plan.authRequirements.required).toBe(true);
    expect(plan.cacheStrategy).toHaveLength(1);
    expect(plan.costEstimate.esiCallCount).toBe(1);
    expect(plan.createdAt).toBeInstanceOf(Date);
  });
});
