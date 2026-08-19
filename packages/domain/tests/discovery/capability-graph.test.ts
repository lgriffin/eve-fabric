import { describe, it, expect } from 'vitest';
import { CapabilityGraph } from '../../src/discovery/capability-graph.js';
import { CapabilityCatalog } from '../../src/capability/catalog.js';
import { semanticTypeId } from '../../src/semantic-type/semantic-type.js';
import {
  marketOrdersDef,
  resolveLocationDef,
  routeDistanceDef,
  securityStatusDef,
  buildTestCatalog,
} from './test-capabilities.js';

describe('CapabilityGraph', () => {
  describe('build', () => {
    it('builds a graph from a catalog with capabilities', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef, routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      expect(graph.size).toBe(3);
    });

    it('builds an empty graph from an empty catalog', () => {
      const catalog = new CapabilityCatalog();
      const graph = CapabilityGraph.build(catalog);
      expect(graph.size).toBe(0);
    });

    it('indexes all semantic types', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef);
      const graph = CapabilityGraph.build(catalog);
      const types = graph.getAllTypes();
      expect(types.has(semanticTypeId('eve.location.reference'))).toBe(true);
      expect(types.has(semanticTypeId('eve.system.reference'))).toBe(true);
      expect(types.has(semanticTypeId('eve.region.reference'))).toBe(true);
      expect(types.has(semanticTypeId('eve.type.reference'))).toBe(true);
      expect(types.has(semanticTypeId('eve.market.order.collection'))).toBe(true);
    });
  });

  describe('getConsumers', () => {
    it('returns capabilities that accept the given semantic type as input', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef, routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      const consumers = graph.getConsumers(semanticTypeId('eve.location.reference'));
      expect(consumers).toHaveLength(1);
      expect(consumers[0]!.id as string).toBe('universe.resolve.location');
    });

    it('returns multiple consumers for a shared semantic type', () => {
      const catalog = buildTestCatalog(routeDistanceDef, securityStatusDef);
      const graph = CapabilityGraph.build(catalog);
      const consumers = graph.getConsumers(semanticTypeId('eve.system.reference'));
      expect(consumers).toHaveLength(2);
    });

    it('returns empty array for unindexed type', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const graph = CapabilityGraph.build(catalog);
      const consumers = graph.getConsumers(semanticTypeId('eve.currency.isk'));
      expect(consumers).toHaveLength(0);
    });
  });

  describe('getProducers', () => {
    it('returns capabilities that produce the given semantic type', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef);
      const graph = CapabilityGraph.build(catalog);
      const producers = graph.getProducers(semanticTypeId('eve.system.reference'));
      expect(producers).toHaveLength(1);
      expect(producers[0]!.id as string).toBe('universe.resolve.location');
    });

    it('returns empty array for unproduced type', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const graph = CapabilityGraph.build(catalog);
      const producers = graph.getProducers(semanticTypeId('eve.system.reference'));
      expect(producers).toHaveLength(0);
    });
  });

  describe('getCapability', () => {
    it('retrieves a capability by ID', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const graph = CapabilityGraph.build(catalog);
      const cap = graph.getCapability(
        'market.orders' as import('../../src/capability/capability-id.js').CapabilityId,
      );
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('Market Orders');
    });

    it('returns undefined for unknown ID', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const graph = CapabilityGraph.build(catalog);
      const cap = graph.getCapability(
        'unknown.cap' as import('../../src/capability/capability-id.js').CapabilityId,
      );
      expect(cap).toBeUndefined();
    });
  });

  describe('getAllTypes', () => {
    it('returns all unique semantic types from inputs and outputs', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef);
      const graph = CapabilityGraph.build(catalog);
      const types = graph.getAllTypes();
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it('returns empty set for empty graph', () => {
      const graph = CapabilityGraph.build(new CapabilityCatalog());
      expect(graph.getAllTypes().size).toBe(0);
    });
  });
});
