import { describe, it, expect } from 'vitest';
import { CapabilityGraph } from '../../src/discovery/capability-graph.js';
import { SatisfactionAnalyzer } from '../../src/discovery/satisfaction-analyzer.js';
import { semanticTypeId } from '../../src/semantic-type/semantic-type.js';
import type { CapabilityId } from '../../src/capability/capability-id.js';
import type { FlowContext } from '../../src/discovery/discovery-types.js';
import {
  marketOrdersDef,
  resolveLocationDef,
  routeDistanceDef,
  marketAggregationDef,
  buildTestCatalog,
} from './test-capabilities.js';

function makeFlowContext(outputTypes: string[], existingIds: string[] = []): FlowContext {
  return {
    availableOutputTypes: new Set(outputTypes.map((t) => semanticTypeId(t))),
    existingCapabilityIds: new Set(existingIds as CapabilityId[]),
    nodeOutputs: new Map(),
  };
}

describe('SatisfactionAnalyzer', () => {
  describe('analyze', () => {
    it('returns fully satisfied when all required inputs available', () => {
      const catalog = buildTestCatalog(resolveLocationDef);
      const graph = CapabilityGraph.build(catalog);
      const analyzer = new SatisfactionAnalyzer(graph);
      const cap = catalog.list()[0]!;
      const flowContext = makeFlowContext(['eve.location.reference']);

      const result = analyzer.analyze(cap, flowContext);
      expect(result.isFullySatisfied).toBe(true);
      expect(result.satisfactionRatio).toBe(1);
      expect(result.satisfiedPorts.size).toBe(1);
      expect(result.unsatisfiedPorts.size).toBe(0);
    });

    it('returns partial when some required inputs available', () => {
      const catalog = buildTestCatalog(marketOrdersDef);
      const graph = CapabilityGraph.build(catalog);
      const analyzer = new SatisfactionAnalyzer(graph);
      const cap = catalog.list()[0]!;
      const flowContext = makeFlowContext(['eve.region.reference']);

      const result = analyzer.analyze(cap, flowContext);
      expect(result.isFullySatisfied).toBe(false);
      expect(result.satisfactionRatio).toBe(0.5);
      expect(result.satisfiedPorts.size).toBe(1);
      expect(result.unsatisfiedPorts.size).toBe(1);
    });

    it('returns unreachable when no required inputs available', () => {
      const catalog = buildTestCatalog(routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      const analyzer = new SatisfactionAnalyzer(graph);
      const cap = catalog.list()[0]!;
      const flowContext = makeFlowContext(['eve.location.reference']);

      const result = analyzer.analyze(cap, flowContext);
      expect(result.isFullySatisfied).toBe(false);
      expect(result.satisfactionRatio).toBe(0);
      expect(result.satisfiedPorts.size).toBe(0);
      expect(result.unsatisfiedPorts.size).toBe(2);
    });

    it('ignores optional inputs in satisfaction calculation', () => {
      const catalog = buildTestCatalog(marketAggregationDef);
      const graph = CapabilityGraph.build(catalog);
      const analyzer = new SatisfactionAnalyzer(graph);
      const cap = catalog.list()[0]!;
      const flowContext = makeFlowContext(['eve.market.order.collection']);

      const result = analyzer.analyze(cap, flowContext);
      expect(result.isFullySatisfied).toBe(true);
      expect(result.satisfactionRatio).toBe(1);
    });
  });

  describe('analyzeAll', () => {
    it('returns satisfaction for all capabilities in the graph', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef, routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      const analyzer = new SatisfactionAnalyzer(graph);
      const flowContext = makeFlowContext(['eve.location.reference']);

      const results = analyzer.analyzeAll(flowContext);
      expect(results.size).toBe(3);
    });

    it('accurately classifies each capability', () => {
      const catalog = buildTestCatalog(marketOrdersDef, resolveLocationDef, routeDistanceDef);
      const graph = CapabilityGraph.build(catalog);
      const analyzer = new SatisfactionAnalyzer(graph);
      const flowContext = makeFlowContext(['eve.location.reference']);

      const results = analyzer.analyzeAll(flowContext);

      const resolveResult = results.get('universe.resolve.location' as CapabilityId);
      expect(resolveResult?.isFullySatisfied).toBe(true);

      const routeResult = results.get('routing.distance' as CapabilityId);
      expect(routeResult?.isFullySatisfied).toBe(false);
    });
  });
});
