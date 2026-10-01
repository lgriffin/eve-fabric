import { describe, it, expect } from 'vitest';
import { DiscoveryEngine } from '../../src/discovery/discovery-engine.js';
import { semanticTypeId } from '../../src/semantic-type/semantic-type.js';
import type { CapabilityId } from '../../src/capability/capability-id.js';
import type { FlowContext } from '../../src/discovery/discovery-types.js';
import {
  marketOrdersDef,
  resolveLocationDef,
  routeDistanceDef,
  securityStatusDef,
  characterLocationDef,
  marketAggregationDef,
  buildTestCatalog,
} from './test-capabilities.js';

function makeFlowContext(
  outputTypes: string[],
  existingIds: string[] = [],
  nodeOutputs?: Record<string, string[]>,
): FlowContext {
  return {
    availableOutputTypes: new Set(outputTypes.map((t) => semanticTypeId(t))),
    existingCapabilityIds: new Set(existingIds as CapabilityId[]),
    nodeOutputs: new Map(
      Object.entries(nodeOutputs ?? {}).map(([k, v]) => [k, v.map((t) => semanticTypeId(t))]),
    ),
  };
}

describe('DiscoveryEngine', () => {
  describe('findConsumers', () => {
    it('returns capabilities that accept the given semantic type', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const consumers = engine.findConsumers(semanticTypeId('eve.location.reference'));
      expect(consumers).toHaveLength(1);
      expect(consumers[0]!.capabilityId as string).toBe('universe.resolve.location');
    });

    it('returns empty array for unknown semantic type', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const consumers = engine.findConsumers(semanticTypeId('eve.unknown.type'));
      expect(consumers).toHaveLength(0);
    });

    it('includes explanation steps', () => {
      const catalog = buildTestCatalog(resolveLocationDef);
      const engine = new DiscoveryEngine(catalog);
      const consumers = engine.findConsumers(semanticTypeId('eve.location.reference'));
      expect(consumers[0]!.explanation).toHaveLength(1);
      expect(consumers[0]!.explanation[0]!.viaCapabilityName).toBe('Resolve Location');
    });

    it('returns multiple consumers when available', () => {
      const catalog = buildTestCatalog(routeDistanceDef, securityStatusDef);
      const engine = new DiscoveryEngine(catalog);
      const consumers = engine.findConsumers(semanticTypeId('eve.system.reference'));
      expect(consumers).toHaveLength(2);
    });
  });

  describe('findProducers', () => {
    it('returns capabilities that produce the given semantic type', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const producers = engine.findProducers(semanticTypeId('eve.system.reference'));
      expect(producers).toHaveLength(1);
      expect(producers[0]!.capabilityId as string).toBe('universe.resolve.location');
    });

    it('returns empty for unproduced type', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const producers = engine.findProducers(semanticTypeId('eve.system.reference'));
      expect(producers).toHaveLength(0);
    });
  });

  describe('findPaths', () => {
    it('finds single-hop bridging path', () => {
      const catalog = buildTestCatalog(resolveLocationDef);
      const engine = new DiscoveryEngine(catalog);
      const paths = engine.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.system.reference'),
      );
      expect(paths).toHaveLength(1);
      expect(paths[0]!.steps).toHaveLength(1);
    });

    it('finds multi-hop bridging path', () => {
      const catalog = buildTestCatalog(characterLocationDef, resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const paths = engine.findPaths(
        semanticTypeId('eve.character.reference'),
        semanticTypeId('eve.route.distance'),
      );
      expect(paths.length).toBeGreaterThanOrEqual(1);
      expect(paths[0]!.steps.length).toBe(3);
    });

    it('returns empty when no path exists', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const paths = engine.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.route.distance'),
      );
      expect(paths).toHaveLength(0);
    });
  });

  describe('buildBridgingProposal', () => {
    it('generates a flow proposal from a path', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const paths = engine.findPaths(
        semanticTypeId('eve.location.reference'),
        semanticTypeId('eve.route.distance'),
      );
      const proposal = engine.buildBridgingProposal(paths[0]!);
      expect(proposal.proposalType).toBe('bridging');
      expect(proposal.capabilitiesToInsert.length).toBe(2);
      expect(proposal.explanation.length).toBe(2);
    });
  });

  describe('search', () => {
    it('matches by capability name', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const results = engine.search('market');
      expect(results).toHaveLength(1);
      expect(results[0]!.capabilityName).toBe('Market Orders');
    });

    it('matches by description', () => {
      const catalog = buildTestCatalog(routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const results = engine.search('distance');
      expect(results).toHaveLength(1);
    });

    it('matches by capability ID', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const results = engine.search('market.orders');
      expect(results).toHaveLength(1);
    });

    it('matches by semantic type keyword', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef);
      const engine = new DiscoveryEngine(catalog);
      const results = engine.search('eve.location.reference');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for no matches', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const results = engine.search('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('includes satisfaction status when flowContext provided', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.location.reference']);
      const results = engine.search('resolve', flowContext);
      expect(results.length).toBeGreaterThanOrEqual(1);
      const resolve = results.find((r) => r.capabilityName === 'Resolve Location');
      expect(resolve).toBeDefined();
      expect(resolve!.readiness).toBe('ready');
    });
  });

  describe('suggestNext', () => {
    it('ranks suggestions by satisfaction ratio', () => {
      const catalog = buildTestCatalog(
        marketOrdersDef,
        resolveLocationDef,
        routeDistanceDef,
        securityStatusDef,
        marketAggregationDef,
      );
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext([
        'eve.location.reference',
        'eve.market.order.collection',
      ]);
      const suggestions = engine.suggestNext(flowContext);
      expect(suggestions.length).toBeGreaterThan(0);

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i]!.relevance).toBeLessThanOrEqual(suggestions[i - 1]!.relevance);
      }
    });

    it('excludes capabilities already in the flow', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(
        ['eve.location.reference'],
        ['universe.resolve.location'],
      );
      const suggestions = engine.suggestNext(flowContext);
      const hasResolve = suggestions.some(
        (s) => (s.capabilityId as string) === 'universe.resolve.location',
      );
      expect(hasResolve).toBe(false);
    });

    it('includes explanations for each suggestion', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.location.reference']);
      const suggestions = engine.suggestNext(flowContext);
      for (const suggestion of suggestions) {
        expect(suggestion.explanation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('autoComplete', () => {
    it('finds path to target capability', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.location.reference']);
      const proposal = engine.autoComplete(flowContext, 'routing.distance' as CapabilityId);
      expect(proposal).not.toBeNull();
      expect(proposal!.proposalType).toBe('auto_complete');
      expect(proposal!.capabilitiesToInsert.length).toBeGreaterThan(0);
    });

    it('returns null when no path exists', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.location.reference']);
      const proposal = engine.autoComplete(flowContext, 'routing.distance' as CapabilityId);
      expect(proposal).toBeNull();
    });

    it('returns null when target capability not found', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.location.reference']);
      const proposal = engine.autoComplete(flowContext, 'nonexistent.cap' as CapabilityId);
      expect(proposal).toBeNull();
    });

    it('returns null when all inputs already satisfied', () => {
      const catalog = buildTestCatalog(resolveLocationDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.location.reference']);
      const proposal = engine.autoComplete(
        flowContext,
        'universe.resolve.location' as CapabilityId,
      );
      expect(proposal).toBeNull();
    });
  });

  describe('suggestConnections', () => {
    it('finds compatible port pairs', () => {
      const catalog = buildTestCatalog(resolveLocationDef, routeDistanceDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.system.reference'], [], {
        'resolve-location-node': ['eve.system.reference'],
      });
      const connections = engine.suggestConnections(
        flowContext,
        'routing.distance' as CapabilityId,
      );
      expect(connections.length).toBeGreaterThan(0);
      expect(connections[0]!.targetType as string).toBe('eve.system.reference');
    });

    it('returns empty for unknown capability', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      const flowContext = makeFlowContext(['eve.location.reference']);
      const connections = engine.suggestConnections(flowContext, 'nonexistent.cap' as CapabilityId);
      expect(connections).toHaveLength(0);
    });
  });

  describe('rebuild', () => {
    it('rebuilds graph after catalog changes', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const engine = new DiscoveryEngine(catalog);
      expect(engine.findConsumers(semanticTypeId('eve.location.reference'))).toHaveLength(0);

      catalog.register(resolveLocationDef());
      engine.rebuild();
      expect(engine.findConsumers(semanticTypeId('eve.location.reference'))).toHaveLength(1);
    });
  });
});
