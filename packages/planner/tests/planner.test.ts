import { describe, it, expect } from 'vitest';
import { planExecution } from '../src/planner.js';
import type { ExecutionPlan, ExecutionStep, StepGroup, SourceRequirement } from '@eve-fabric/core';

// Helper to build a minimal ExecutionPlan for testing
function makePlan(overrides: {
  steps: readonly ExecutionStep[];
  parallelGroups?: readonly StepGroup[];
  sourceRequirements?: readonly SourceRequirement[];
}): ExecutionPlan {
  return {
    id: 'test-plan',
    pipelineRef: { id: 'test-pipeline', version: 1 },
    steps: overrides.steps,
    parallelGroups: overrides.parallelGroups ?? [],
    sourceRequirements: overrides.sourceRequirements ?? [],
    authRequirements: { required: false, scopes: [] },
    cacheStrategy: [],
    costEstimate: { totalLatencyMs: 0, esiCallCount: 0, parallelLatencyMs: 0 },
    createdAt: new Date(),
  } as ExecutionPlan;
}

function makeStep(id: string, overrides?: Partial<ExecutionStep>): ExecutionStep {
  return {
    id,
    capability: { id: `test.${id}` as never, version: undefined },
    inputs: [],
    dependsOn: [],
    canParallelize: true,
    ...overrides,
  } as ExecutionStep;
}

describe('planExecution', () => {
  describe('topological ordering', () => {
    it('orders a single step', () => {
      const plan = makePlan({
        steps: [makeStep('a')],
      });
      const result = planExecution(plan);
      expect(result.orderedSteps).toEqual(['a']);
    });

    it('orders independent steps', () => {
      const plan = makePlan({
        steps: [makeStep('a'), makeStep('b'), makeStep('c')],
      });
      const result = planExecution(plan);
      expect(result.orderedSteps).toHaveLength(3);
      expect(new Set(result.orderedSteps)).toEqual(new Set(['a', 'b', 'c']));
    });

    it('respects dependencies', () => {
      const plan = makePlan({
        steps: [
          makeStep('a'),
          makeStep('b', { dependsOn: ['a'] }),
          makeStep('c', { dependsOn: ['b'] }),
        ],
      });
      const result = planExecution(plan);
      expect(result.orderedSteps.indexOf('a')).toBeLessThan(result.orderedSteps.indexOf('b'));
      expect(result.orderedSteps.indexOf('b')).toBeLessThan(result.orderedSteps.indexOf('c'));
    });

    it('handles diamond dependencies', () => {
      const plan = makePlan({
        steps: [
          makeStep('a'),
          makeStep('b', { dependsOn: ['a'] }),
          makeStep('c', { dependsOn: ['a'] }),
          makeStep('d', { dependsOn: ['b', 'c'] }),
        ],
      });
      const result = planExecution(plan);
      const indexOf = (id: string) => result.orderedSteps.indexOf(id);
      expect(indexOf('a')).toBeLessThan(indexOf('b'));
      expect(indexOf('a')).toBeLessThan(indexOf('c'));
      expect(indexOf('b')).toBeLessThan(indexOf('d'));
      expect(indexOf('c')).toBeLessThan(indexOf('d'));
    });

    it('throws on cyclic dependencies', () => {
      const plan = makePlan({
        steps: [makeStep('a', { dependsOn: ['b'] }), makeStep('b', { dependsOn: ['a'] })],
      });
      expect(() => planExecution(plan)).toThrow(/[Cc]ycle/);
    });
  });

  describe('parallel groups', () => {
    it('groups independent parallelizable steps', () => {
      const plan = makePlan({
        steps: [makeStep('a'), makeStep('b'), makeStep('c')],
      });
      const result = planExecution(plan);
      expect(result.parallelGroups.length).toBeGreaterThanOrEqual(1);
      const allGroupedIds = result.parallelGroups.flatMap((g) => [...g.stepIds]);
      expect(allGroupedIds).toContain('a');
      expect(allGroupedIds).toContain('b');
      expect(allGroupedIds).toContain('c');
    });

    it('does not group sequential dependent steps', () => {
      const plan = makePlan({
        steps: [
          makeStep('a'),
          makeStep('b', { dependsOn: ['a'] }),
          makeStep('c', { dependsOn: ['b'] }),
        ],
      });
      const result = planExecution(plan);
      // Each step is at a different level, so no parallel groups
      // (a group needs >1 step)
      for (const group of result.parallelGroups) {
        const ids = [...group.stepIds];
        // No group should contain both 'a' and 'b', or 'b' and 'c'
        expect(ids.includes('a') && ids.includes('b')).toBe(false);
        expect(ids.includes('b') && ids.includes('c')).toBe(false);
      }
    });

    it('excludes non-parallelizable steps from groups', () => {
      const plan = makePlan({
        steps: [makeStep('a', { canParallelize: false }), makeStep('b'), makeStep('c')],
      });
      const result = planExecution(plan);
      for (const group of result.parallelGroups) {
        expect([...group.stepIds]).not.toContain('a');
      }
    });

    it('creates parallel groups for steps at the same dependency level', () => {
      const plan = makePlan({
        steps: [
          makeStep('root'),
          makeStep('a', { dependsOn: ['root'] }),
          makeStep('b', { dependsOn: ['root'] }),
          makeStep('c', { dependsOn: ['root'] }),
        ],
      });
      const result = planExecution(plan);
      const secondLevelGroup = result.parallelGroups.find(
        (g) => g.stepIds.includes('a') && g.stepIds.includes('b'),
      );
      expect(secondLevelGroup).toBeDefined();
      expect([...secondLevelGroup!.stepIds]).toContain('c');
    });
  });

  describe('coalesced requests', () => {
    it('groups steps by source', () => {
      const plan = makePlan({
        steps: [
          makeStep('a', { capability: { id: 'market.orders' as never } }),
          makeStep('b', { capability: { id: 'market.history' as never } }),
          makeStep('c', { capability: { id: 'sde.types' as never } }),
        ],
        sourceRequirements: [
          {
            source: 'ESI' as never,
            capabilities: [{ id: 'market.orders' as never }, { id: 'market.history' as never }],
          },
          {
            source: 'SDE' as never,
            capabilities: [{ id: 'sde.types' as never }],
          },
        ],
      });
      const result = planExecution(plan);
      expect(result.coalescedRequests).toHaveLength(2);

      const esiGroup = result.coalescedRequests.find((g) => g.source === 'ESI');
      expect(esiGroup).toBeDefined();
      expect([...esiGroup!.stepIds]).toContain('a');
      expect([...esiGroup!.stepIds]).toContain('b');

      const sdeGroup = result.coalescedRequests.find((g) => g.source === 'SDE');
      expect(sdeGroup).toBeDefined();
      expect([...sdeGroup!.stepIds]).toEqual(['c']);
    });

    it('returns empty coalesced groups when no source requirements', () => {
      const plan = makePlan({
        steps: [makeStep('a')],
        sourceRequirements: [],
      });
      const result = planExecution(plan);
      expect(result.coalescedRequests).toHaveLength(0);
    });
  });

  describe('empty plan', () => {
    it('handles an empty plan', () => {
      const plan = makePlan({ steps: [] });
      const result = planExecution(plan);
      expect(result.orderedSteps).toEqual([]);
      expect(result.parallelGroups).toEqual([]);
      expect(result.coalescedRequests).toEqual([]);
    });
  });
});
