import { describe, it, expect } from 'vitest';
import { CapabilityGraph } from '../../src/discovery/capability-graph.js';
import { PathFinder } from '../../src/discovery/path-finder.js';
import { semanticTypeId } from '../../src/semantic-type/semantic-type.js';
import {
  marketOrdersDef,
  resolveLocationDef,
  routeDistanceDef,
  securityStatusDef,
  characterLocationDef,
  buildTestCatalog,
} from './test-capabilities.js';

describe('PathFinder', () => {
  describe('findPaths', () => {
    it('finds a single-hop path', () => {
      const catalog = buildTestCatalog(resolveLocationDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.system.reference'),
      );

      expect(paths).toHaveLength(1);
      expect(paths[0]!.steps).toHaveLength(1);
      expect(paths[0]!.steps[0]!.capabilityId as string).toBe('universe.resolve.location');
      expect(paths[0]!.sourceType as string).toBe('eve.location.reference');
      expect(paths[0]!.targetType as string).toBe('eve.system.reference');
    });

    it('finds a multi-hop path', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef, routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.route.distance'),
      );

      expect(paths.length).toBeGreaterThanOrEqual(1);
      const path = paths[0]!;
      expect(path.steps.length).toBe(2);
      expect(path.steps[0]!.capabilityId as string).toBe('universe.resolve.location');
      expect(path.steps[1]!.capabilityId as string).toBe('routing.distance');
    });

    it('returns empty array when no path exists', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.route.distance'),
      );

      expect(paths).toHaveLength(0);
    });

    it('returns empty array when source equals target', () => {
      const catalog = buildTestCatalog(resolveLocationDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.system.reference'),
        semanticTypeId('eve.system.reference'),
      );

      expect(paths).toHaveLength(0);
    });

    it('detects and avoids cycles', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef, securityStatusDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.security.status'),
      );

      for (const path of paths) {
        const capIds = path.steps.map((s) => s.capabilityId as string);
        const unique = new Set(capIds);
        expect(unique.size).toBe(capIds.length);
      }
    });

    it('respects depth limit', () => {
      const catalog = buildTestCatalog(characterLocationDef, resolveLocationDef, routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.character.reference'),
        semanticTypeId('eve.route.distance'),
        { maxDepth: 2 },
      );

      expect(paths).toHaveLength(0);

      const deeperPaths = finder.findPaths(
        semanticTypeId('eve.character.reference'),
        semanticTypeId('eve.route.distance'),
        { maxDepth: 5 },
      );

      expect(deeperPaths.length).toBeGreaterThanOrEqual(1);
    });

    it('ranks paths by length (shortest first)', () => {
      const catalog = buildTestCatalog(
        characterLocationDef,
        resolveLocationDef,
        routeDistanceDef,
        securityStatusDef,
      );
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.character.reference'),
        semanticTypeId('eve.security.status'),
      );

      for (let i = 1; i < paths.length; i++) {
        expect(paths[i]!.length).toBeGreaterThanOrEqual(paths[i - 1]!.length);
      }
    });

    it('limits results to maxResults', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef, securityStatusDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.security.status'),
        { maxResults: 1 },
      );

      expect(paths.length).toBeLessThanOrEqual(1);
    });

    it('computes totalEstimatedCost as sum of step latencies', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.route.distance'),
      );

      expect(paths.length).toBeGreaterThanOrEqual(1);
      const path = paths[0]!;
      const expectedCost = path.steps.reduce((sum, s) => sum + s.estimatedLatencyMs, 0);
      expect(path.totalEstimatedCost).toBe(expectedCost);
    });

    it('detects auth requirements across path steps', () => {
      const catalog = buildTestCatalog(characterLocationDef, resolveLocationDef);
      const graph = CapabilityGraph.build(catalog);
      const finder = new PathFinder(graph);

      const paths = finder.findPaths(
        semanticTypeId('eve.character.reference'),
        semanticTypeId('eve.system.reference'),
      );

      expect(paths.length).toBeGreaterThanOrEqual(1);
      const path = paths[0]!;
      expect(path.requiresAuth).toBe(true);
      expect(path.authScopes).toContain('esi-location.read_location.v1');
    });
  });
});
