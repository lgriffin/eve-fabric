import type { PipelineDefinition, PipelineInput, PipelineNode } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion, semanticTypeId } from '@eve-fabric/domain';
import type { Fabric } from '@eve-fabric/fabric';

function input(name: string, type: string, description: string): PipelineInput {
  return { name, semanticType: semanticTypeId(type), description, required: true };
}

function node(id: string, capability: string, version: string): PipelineNode {
  return { id, capability: { id: capabilityId(capability), version: capabilityVersion(version) } };
}

const marketSnapshot: PipelineDefinition = {
  id: 'demo-market-snapshot',
  version: 1,
  name: 'Market Snapshot',
  inputs: [
    input('item', 'eve.type.reference', 'Item type to look up'),
    input('region', 'eve.region.reference', 'Target region'),
  ],
  nodes: [node('orders', 'market.orders', '2.0.0'), node('prices', 'market.aggregate', '2.0.0')],
  edges: [
    { from: 'input.item', to: 'orders.item' },
    { from: 'input.region', to: 'orders.region' },
    { from: 'orders.orders', to: 'prices.orders' },
  ],
  outputs: [
    { name: 'orders', source: 'orders.orders' },
    { name: 'lowestSell', source: 'prices.lowestSell' },
    { name: 'highestBuy', source: 'prices.highestBuy' },
  ],
};

const routeAnalysis: PipelineDefinition = {
  id: 'demo-route-analysis',
  version: 1,
  name: 'Route Analysis',
  inputs: [
    input('origin', 'eve.system.reference', 'Origin solar system'),
    input('destination', 'eve.system.reference', 'Destination solar system'),
  ],
  nodes: [node('route', 'route.distance', '2.0.0')],
  edges: [
    { from: 'input.origin', to: 'route.origin' },
    { from: 'input.destination', to: 'route.destination' },
  ],
  outputs: [{ name: 'distance', source: 'route.distance' }],
};

const haulingCost: PipelineDefinition = {
  id: 'demo-hauling-cost',
  version: 1,
  name: 'Hauling Cost',
  inputs: [
    input('origin', 'eve.system.reference', 'Origin solar system'),
    input('destination', 'eve.system.reference', 'Destination solar system'),
    input('collateral', 'eve.currency.isk', 'Cargo value for collateral'),
  ],
  nodes: [
    node('route', 'composite.route.analysis', '1.0.0'),
    node('freight', 'logistics.freight.estimate', '2.0.0'),
  ],
  edges: [
    { from: 'input.origin', to: 'route.origin' },
    { from: 'input.destination', to: 'route.destination' },
    { from: 'route.distance', to: 'freight.distance' },
    { from: 'input.collateral', to: 'freight.collateral' },
  ],
  outputs: [
    { name: 'cost', source: 'freight.cost' },
    { name: 'distance', source: 'route.distance' },
  ],
};

const tradeOpportunity: PipelineDefinition = {
  id: 'demo-trade-opportunity',
  version: 1,
  name: 'Trade Opportunity',
  inputs: [
    input('item', 'eve.type.reference', 'Item type to evaluate'),
    input('region', 'eve.region.reference', 'Market region'),
    input('origin', 'eve.system.reference', 'Origin solar system'),
    input('destination', 'eve.system.reference', 'Destination solar system'),
    input('collateral', 'eve.currency.isk', 'Cargo value for collateral'),
  ],
  nodes: [
    node('market', 'composite.market.snapshot', '1.0.0'),
    node('route', 'composite.route.analysis', '1.0.0'),
    node('hauling', 'composite.hauling.cost', '1.0.0'),
  ],
  edges: [
    { from: 'input.item', to: 'market.item' },
    { from: 'input.region', to: 'market.region' },
    { from: 'input.origin', to: 'route.origin' },
    { from: 'input.destination', to: 'route.destination' },
    { from: 'input.origin', to: 'hauling.origin' },
    { from: 'input.destination', to: 'hauling.destination' },
    { from: 'input.collateral', to: 'hauling.collateral' },
  ],
  outputs: [
    { name: 'lowestSell', source: 'market.lowestSell' },
    { name: 'highestBuy', source: 'market.highestBuy' },
    { name: 'haulingCost', source: 'hauling.cost' },
    { name: 'distance', source: 'route.distance' },
  ],
};

/**
 * Publishes the demo composites. Each is a real pipeline that compiles and
 * runs; the fabric refuses to publish one that does not (the publish gate).
 */
export function seedDemoComposites(fabric: Fabric): void {
  fabric.publishComposite(marketSnapshot, {
    id: 'composite.market.snapshot',
    version: '1.0.0',
    name: 'Market Snapshot',
    description: 'Published composite: fetches and aggregates market data for an item in a region',
  });
  fabric.publishComposite(routeAnalysis, {
    id: 'composite.route.analysis',
    version: '1.0.0',
    name: 'Route Analysis',
    description: 'Published composite: analyses a route between two solar systems',
  });
  fabric.publishComposite(haulingCost, {
    id: 'composite.hauling.cost',
    version: '1.0.0',
    name: 'Hauling Cost',
    description: 'Published composite: estimates a freight quote from the route and cargo value',
  });
  fabric.publishComposite(tradeOpportunity, {
    id: 'composite.trade.opportunity',
    version: '1.0.0',
    name: 'Trade Opportunity',
    description:
      'Published composite: combines market snapshot, route analysis, and hauling cost into a single trade evaluation',
  });
}
