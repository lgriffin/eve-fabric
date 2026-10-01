import { describe, it, expect } from 'vitest';
import { capabilityId, capabilityVersion, semanticTypeId } from '@eve-fabric/domain';
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { REGION, SYSTEM, TYPE, tranquilityEsi, tranquilitySde } from '@eve-fabric/test-support';
import { seedDemoComposites } from '../../src/seed-demo.js';

function seededFabric() {
  const fabric = createFabric({
    esi: tranquilityEsi().esi,
    sde: tranquilitySde(),
    packs: [corePack],
  });
  seedDemoComposites(fabric);
  return fabric;
}

const ref = (id: string) => [capabilityId(id), capabilityVersion('1.0.0')] as const;

describe('seedDemoComposites', () => {
  it('publishes four composites, each over a pipeline the fabric holds', () => {
    const fabric = seededFabric();
    const composites = fabric.registry.list({ source: 'COMPOSITE' });
    expect(composites.map((c) => c.id as string).sort()).toEqual([
      'composite.hauling.cost',
      'composite.market.snapshot',
      'composite.route.analysis',
      'composite.trade.opportunity',
    ]);
    for (const composite of composites) {
      const { id, version } = composite.pipelineRef!;
      expect(fabric.getPipeline(id, version)).toBeDefined();
    }
  });

  it('derives each composite contract from its pipeline', () => {
    const fabric = seededFabric();
    const snapshot = fabric.registry.get(...ref('composite.market.snapshot'))!;
    expect([...snapshot.inputs.keys()]).toEqual(['item', 'region']);
    expect(snapshot.outputs.get('lowestSell')?.semanticType).toBe('eve.currency.isk');

    const hauling = fabric.registry.get(...ref('composite.hauling.cost'))!;
    expect(hauling.inputs.has('collateral')).toBe(true);
    expect(hauling.outputs.has('cost')).toBe(true);
  });

  it('builds the trade opportunity dependency tree from the three composites', () => {
    const fabric = seededFabric();
    const tree = fabric.registry.getDependencyGraph(...ref('composite.trade.opportunity'));
    expect(tree!.children.map((c) => c.id as string).sort()).toEqual([
      'composite.hauling.cost',
      'composite.market.snapshot',
      'composite.route.analysis',
    ]);
  });

  it('runs the trade opportunity end to end', async () => {
    const fabric = seededFabric();
    const input = (name: string, type: string) => ({
      name,
      semanticType: semanticTypeId(type),
      required: true,
    });
    const result = await fabric.run(
      {
        id: 'trade',
        version: 1,
        name: 'Trade',
        inputs: [
          input('item', 'eve.type.reference'),
          input('region', 'eve.region.reference'),
          input('origin', 'eve.system.reference'),
          input('destination', 'eve.system.reference'),
          input('collateral', 'eve.currency.isk'),
        ],
        nodes: [
          {
            id: 't',
            capability: {
              id: capabilityId('composite.trade.opportunity'),
              version: capabilityVersion('1.0.0'),
            },
          },
        ],
        edges: ['item', 'region', 'origin', 'destination', 'collateral'].map((p) => ({
          from: `input.${p}`,
          to: `t.${p}`,
        })),
        outputs: [{ name: 'haulingCost', source: 't.haulingCost' }],
      },
      {
        item: TYPE.tritanium,
        region: REGION.theForge,
        origin: SYSTEM.jita,
        destination: SYSTEM.amarr,
        collateral: 100_000_000,
      },
    );
    expect(result.outputs.get('t/market/prices')).toEqual({ lowestSell: 3.98, highestBuy: 3.71 });
    expect(result.outputs.get('t/hauling/freight')).toEqual({ cost: 3_000_000 });
  });
});
