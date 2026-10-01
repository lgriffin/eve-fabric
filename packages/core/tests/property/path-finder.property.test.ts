import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CapabilityGraph } from '../../src/discovery/capability-graph.js';
import { PathFinder } from '../../src/discovery/path-finder.js';
import { CapabilityCatalog } from '../../src/capability/catalog.js';
import { semanticTypeId } from '../../src/semantic-type/semantic-type.js';

const validSegment = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 1,
    maxLength: 6,
  })
  .filter((s) => /^[a-z]/.test(s));

const validTypeArb = fc.tuple(validSegment, validSegment).map(([a, b]) => `eve.${a}.${b}`);

const validCapIdArb = fc.tuple(validSegment, validSegment).map(([a, b]) => `cap.${a}.${b}`);

function makeCapDef(id: string, inputType: string, outputType: string) {
  return {
    id,
    version: 1,
    name: `Cap ${id}`,
    description: `Converts ${inputType} to ${outputType}`,
    inputs: {
      input: { name: 'input', semanticType: inputType, required: true },
    },
    outputs: {
      output: { name: 'output', semanticType: outputType, required: true },
    },
    source: 'DERIVED' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
  };
}

const chainArb = fc
  .tuple(
    fc.array(validTypeArb, { minLength: 2, maxLength: 6 }),
    fc.array(validCapIdArb, { minLength: 1, maxLength: 5 }),
  )
  .filter(([types, capIds]) => {
    const uniqueTypes = new Set(types);
    const uniqueCaps = new Set(capIds);
    return (
      uniqueTypes.size === types.length &&
      uniqueCaps.size === capIds.length &&
      capIds.length === types.length - 1
    );
  });

describe('PathFinder property tests', () => {
  it('all paths are cycle-free (no capability appears twice)', () => {
    fc.assert(
      fc.property(chainArb, ([types, capIds]) => {
        const catalog = new CapabilityCatalog();
        for (let i = 0; i < capIds.length; i++) {
          catalog.register(makeCapDef(capIds[i]!, types[i]!, types[i + 1]!));
        }
        const graph = CapabilityGraph.build(catalog);
        const finder = new PathFinder(graph);
        const source = semanticTypeId(types[0]!);
        const target = semanticTypeId(types[types.length - 1]!);
        const paths = finder.findPaths(source, target);

        for (const path of paths) {
          const ids = path.steps.map((s) => s.capabilityId as string);
          expect(new Set(ids).size).toBe(ids.length);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('consecutive steps have matching types', () => {
    fc.assert(
      fc.property(chainArb, ([types, capIds]) => {
        const catalog = new CapabilityCatalog();
        for (let i = 0; i < capIds.length; i++) {
          catalog.register(makeCapDef(capIds[i]!, types[i]!, types[i + 1]!));
        }
        const graph = CapabilityGraph.build(catalog);
        const finder = new PathFinder(graph);
        const source = semanticTypeId(types[0]!);
        const target = semanticTypeId(types[types.length - 1]!);
        const paths = finder.findPaths(source, target);

        for (const path of paths) {
          for (let i = 1; i < path.steps.length; i++) {
            expect(path.steps[i - 1]!.outputType as string).toBe(
              path.steps[i]!.inputType as string,
            );
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it('paths respect depth limit', () => {
    fc.assert(
      fc.property(chainArb, fc.integer({ min: 1, max: 5 }), ([types, capIds], maxDepth) => {
        const catalog = new CapabilityCatalog();
        for (let i = 0; i < capIds.length; i++) {
          catalog.register(makeCapDef(capIds[i]!, types[i]!, types[i + 1]!));
        }
        const graph = CapabilityGraph.build(catalog);
        const finder = new PathFinder(graph);
        const source = semanticTypeId(types[0]!);
        const target = semanticTypeId(types[types.length - 1]!);
        const paths = finder.findPaths(source, target, { maxDepth });

        for (const path of paths) {
          expect(path.steps.length).toBeLessThanOrEqual(maxDepth);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('sourceType and targetType are correct on all returned paths', () => {
    fc.assert(
      fc.property(chainArb, ([types, capIds]) => {
        const catalog = new CapabilityCatalog();
        for (let i = 0; i < capIds.length; i++) {
          catalog.register(makeCapDef(capIds[i]!, types[i]!, types[i + 1]!));
        }
        const graph = CapabilityGraph.build(catalog);
        const finder = new PathFinder(graph);
        const source = semanticTypeId(types[0]!);
        const target = semanticTypeId(types[types.length - 1]!);
        const paths = finder.findPaths(source, target);

        for (const path of paths) {
          expect(path.sourceType as string).toBe(source as string);
          expect(path.targetType as string).toBe(target as string);
          if (path.steps.length > 0) {
            expect(path.steps[0]!.inputType as string).toBe(source as string);
            expect(path.steps[path.steps.length - 1]!.outputType as string).toBe(target as string);
          }
        }
      }),
      { numRuns: 50 },
    );
  });
});
