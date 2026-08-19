import type { InMemoryFabricRegistry } from '@eve-fabric/domain';
import {
  capabilityId,
  capabilityVersion,
  semanticTypeId,
  type SemanticPort,
  type CapabilityDefinition,
  type CapabilityRef,
} from '@eve-fabric/domain';

function port(
  name: string,
  type: string,
  required = true,
  description?: string,
): [string, SemanticPort] {
  return [name, { name, semanticType: semanticTypeId(type), required, description }];
}

function ref(id: string, version?: string): CapabilityRef {
  return version
    ? { id: capabilityId(id), version: capabilityVersion(version) }
    : { id: capabilityId(id) };
}

function compositeCapability(config: {
  id: string;
  version: string;
  name: string;
  description: string;
  inputs: [string, SemanticPort][];
  outputs: [string, SemanticPort][];
  dependencies: CapabilityRef[];
  pipelineId: string;
}): CapabilityDefinition {
  return {
    id: capabilityId(config.id),
    version: capabilityVersion(config.version),
    name: config.name,
    description: config.description,
    inputs: new Map(config.inputs),
    outputs: new Map(config.outputs),
    source: 'COMPOSITE',
    dependencies: config.dependencies,
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
    pipelineRef: { id: config.pipelineId, version: 1 },
  };
}

export function seedDemoCapabilities(registry: InMemoryFabricRegistry): void {
  const compositeMarketSnapshot = compositeCapability({
    id: 'composite.market.snapshot',
    version: '1.0.0',
    name: 'Market Snapshot',
    description: 'Published composite: fetches and aggregates market data for an item in a region',
    inputs: [
      port('item', 'eve.type.reference', true, 'Item type to look up'),
      port('region', 'eve.region.reference', true, 'Target region'),
    ],
    outputs: [
      port('orders', 'eve.market.order.collection', true, 'List of market orders'),
      port('lowestSell', 'eve.currency.isk', true, 'Lowest sell price'),
      port('highestBuy', 'eve.currency.isk', true, 'Highest buy price'),
    ],
    dependencies: [ref('market.orders', '1.0.0'), ref('market.aggregate', '1.0.0')],
    pipelineId: 'demo-market-snapshot',
  });

  const compositeRouteAnalysis = compositeCapability({
    id: 'composite.route.analysis',
    version: '1.0.0',
    name: 'Route Analysis',
    description: 'Published composite: analyses a route between two solar systems',
    inputs: [
      port('origin', 'eve.system.reference', true, 'Origin solar system'),
      port('destination', 'eve.system.reference', true, 'Destination solar system'),
    ],
    outputs: [port('distance', 'eve.route.distance', true, 'Jump count between systems')],
    dependencies: [ref('route.distance', '1.0.0')],
    pipelineId: 'demo-route-analysis',
  });

  const compositeHaulingCost = compositeCapability({
    id: 'composite.hauling.cost',
    version: '1.0.0',
    name: 'Hauling Cost',
    description: 'Published composite: estimates hauling cost based on route and cargo value',
    inputs: [
      port('origin', 'eve.system.reference', true, 'Origin solar system'),
      port('destination', 'eve.system.reference', true, 'Destination solar system'),
      port('volume', 'eve.currency.isk', true, 'Collateral / cargo value'),
    ],
    outputs: [
      port('cost', 'eve.currency.isk', true, 'Estimated hauling cost'),
      port('distance', 'eve.route.distance', true, 'Jump count for the route'),
    ],
    dependencies: [ref('route.distance', '1.0.0')],
    pipelineId: 'demo-hauling-cost',
  });

  const tradeOpportunity = compositeCapability({
    id: 'composite.trade.opportunity',
    version: '1.0.0',
    name: 'Trade Opportunity',
    description:
      'Published composite: combines market snapshot, route analysis, and hauling cost into a single trade evaluation',
    inputs: [
      port('item', 'eve.type.reference', true, 'Item type to evaluate'),
      port('region', 'eve.region.reference', true, 'Market region'),
      port('origin', 'eve.system.reference', true, 'Origin solar system'),
      port('destination', 'eve.system.reference', true, 'Destination solar system'),
      port('volume', 'eve.currency.isk', true, 'Collateral / cargo value'),
    ],
    outputs: [
      port('lowestSell', 'eve.currency.isk', true, 'Lowest sell price at destination'),
      port('highestBuy', 'eve.currency.isk', true, 'Highest buy price at origin'),
      port('haulingCost', 'eve.currency.isk', true, 'Estimated hauling cost'),
      port('distance', 'eve.route.distance', true, 'Jump distance'),
    ],
    dependencies: [
      ref('composite.market.snapshot', '1.0.0'),
      ref('composite.route.analysis', '1.0.0'),
      ref('composite.hauling.cost', '1.0.0'),
    ],
    pipelineId: 'demo-trade-opportunity',
  });

  registry.register(compositeMarketSnapshot);
  registry.register(compositeRouteAnalysis);
  registry.register(compositeHaulingCost);
  registry.register(tradeOpportunity);
}
