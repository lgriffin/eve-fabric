/**
 * EVE Fabric — live ESI smoke test
 *
 * Runs the core pack against Tranquility: one market lookup filtered to an
 * item, its price summary, and a route. Names come from the SDE fixture; the
 * prices and the route come from ESI live. Exits non-zero if any step fails,
 * so the nightly workflow notices when ESI or ESI.ts moves under us.
 *
 * Run: pnpm run demo:esi
 */
import {
  capabilityId,
  capabilityVersion,
  semanticTypeId,
  type PipelineDefinition,
  type PipelineNode,
} from '@eve-fabric/domain';
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { tranquilitySde } from '@eve-fabric/test-support';
import { createEsi } from '@lgriffin/esi.ts/client';

const COMPATIBILITY_DATE = '2026-08-18';

function node(id: string, capability: string): PipelineNode {
  return { id, capability: { id: capabilityId(capability), version: capabilityVersion('2.0.0') } };
}

function input(name: string, type: string) {
  return { name, semanticType: semanticTypeId(type), required: true };
}

const tradeHubs: PipelineDefinition = {
  id: 'esi-live',
  version: 1,
  name: 'Live trade hub check',
  inputs: [
    input('item', 'eve.type.reference'),
    input('region', 'eve.region.reference'),
    input('origin', 'eve.system.reference'),
    input('destination', 'eve.system.reference'),
  ],
  nodes: [
    node('type', 'universe.resolve.type'),
    node('region', 'universe.resolve.region'),
    node('origin', 'universe.resolve.solar.system'),
    node('destination', 'universe.resolve.solar.system'),
    node('orders', 'market.orders'),
    node('prices', 'market.aggregate'),
    node('route', 'route.distance'),
  ],
  edges: [
    { from: 'input.item', to: 'type.query' },
    { from: 'input.region', to: 'region.query' },
    { from: 'input.origin', to: 'origin.query' },
    { from: 'input.destination', to: 'destination.query' },
    { from: 'type.type', to: 'orders.item' },
    { from: 'region.region', to: 'orders.region' },
    { from: 'orders.orders', to: 'prices.orders' },
    { from: 'origin.system', to: 'route.origin' },
    { from: 'destination.system', to: 'route.destination' },
  ],
  outputs: [
    { name: 'lowestSell', source: 'prices.lowestSell' },
    { name: 'highestBuy', source: 'prices.highestBuy' },
    { name: 'jumps', source: 'route.distance' },
  ],
};

async function main(): Promise<void> {
  const esi = createEsi({
    userAgent:
      process.env['ESI_USER_AGENT'] ?? 'eve-fabric/0.1 (+https://github.com/lgriffin/eve-fabric)',
    compatibilityDate: COMPATIBILITY_DATE,
  });
  const fabric = createFabric({
    esi,
    esiCompatibilityDate: COMPATIBILITY_DATE,
    sde: tranquilitySde(),
    packs: [corePack],
  });

  try {
    const result = await fabric.run(tradeHubs, {
      item: 'Tritanium',
      region: 'The Forge',
      origin: 'Jita',
      destination: 'Amarr',
    });
    const prices = result.outputs.get('prices') ?? {};
    const route = result.outputs.get('route') ?? {};
    const orders = result.outputs.get('orders')?.['orders'];

    console.log(`Tritanium in The Forge: ${Array.isArray(orders) ? orders.length : 0} orders`);
    console.log(`  lowest sell ${String(prices['lowestSell'])} ISK`);
    console.log(`  highest buy ${String(prices['highestBuy'])} ISK`);
    console.log(`Jita to Amarr: ${String(route['distance'])} jumps`);
    console.log(`Provenance: ${result.provenance.get('orders')?.sourceVersion ?? 'unknown'}`);

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error('ESI returned no Tritanium orders in The Forge');
    }
    if (typeof route['distance'] !== 'number' || route['distance'] < 1) {
      throw new Error('ESI returned no route from Jita to Amarr');
    }
  } finally {
    esi.shutdown();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
