import { defineCapability } from '@eve-fabric/kit';
import type { Blueprint, IStaticDataProvider } from '@lgriffin/esi.ts/sde';
import { collect, requireId, sellOrders } from '../support.js';

/** Product type id to the blueprint that manufactures it, built once per provider. */
const productIndex = new WeakMap<IStaticDataProvider, ReadonlyMap<number, number>>();

function blueprintFor(sde: IStaticDataProvider, productTypeId: number): number | undefined {
  let index = productIndex.get(sde);
  if (index === undefined) {
    const built = new Map<number, number>();
    for (const bp of sde.getAllEntities<Blueprint>('eve_blueprints')) {
      for (const product of bp.activities.manufacturing?.products ?? []) {
        if (!built.has(product.typeId)) built.set(product.typeId, bp.blueprintTypeId);
      }
    }
    index = built;
    productIndex.set(sde, index);
  }
  return index.get(productTypeId);
}

export const blueprintLookup = defineCapability({
  id: 'industry.blueprint.lookup',
  version: '2.0.0',
  name: 'Blueprint Lookup',
  description:
    'Look up the blueprint that manufactures an item — the starting point for its materials and build cost',
  inputs: {
    item: { type: 'eve.type.reference', description: 'Item type to find the blueprint for' },
  },
  outputs: {
    blueprint: { type: 'eve.type.reference', description: 'Blueprint type ID' },
  },
  attach: { on: 'eve.type', as: 'blueprint', subject: 'item' },
  uses: ['sde'],
  cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true },
  cost: { estimatedLatencyMs: 10 },
  run({ item }, { sde }) {
    const itemId = requireId(item, 'item');
    const blueprint = blueprintFor(sde, itemId);
    if (blueprint === undefined)
      throw new Error(`No blueprint in the SDE manufactures type ${itemId}`);
    return { blueprint };
  },
});

export const blueprintMaterials = defineCapability({
  id: 'industry.blueprint.materials',
  version: '2.0.0',
  name: 'Blueprint Materials',
  description: 'The materials one manufacturing run of a blueprint consumes, from the SDE',
  inputs: {
    blueprint: { type: 'eve.type.reference', description: 'Blueprint type ID' },
  },
  outputs: {
    materials: { type: 'eve.material.collection', description: 'Types and quantities per run' },
  },
  attach: { on: 'eve.type', as: 'materials', subject: 'blueprint' },
  uses: ['sde'],
  cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true },
  cost: { estimatedLatencyMs: 10 },
  run({ blueprint }, { sde }) {
    const blueprintId = requireId(blueprint, 'blueprint');
    const found = sde
      .getAllEntities<Blueprint>('eve_blueprints')
      .find((bp) => bp.blueprintTypeId === blueprintId);
    if (found === undefined) throw new Error(`Type ${blueprintId} is not a blueprint in the SDE`);
    const materials = found.activities.manufacturing?.materials ?? [];
    return { materials: materials.map((m) => ({ type_id: m.typeId, quantity: m.quantity })) };
  },
});

export const materialCost = defineCapability({
  id: 'industry.material.cost',
  version: '2.0.0',
  name: 'Material Cost',
  description:
    "What a material costs at a region's cheapest sell price: its quantity times that price",
  inputs: {
    material: { type: 'eve.material', description: 'A type and quantity' },
    region: { type: 'eve.region.reference', description: 'Region to buy in' },
  },
  outputs: {
    cost: { type: 'eve.currency.isk', description: 'Quantity times the cheapest sell price' },
  },
  attach: { on: 'eve.material', as: 'cheapest price', subject: 'material' },
  uses: ['esi.public'],
  cost: { estimatedLatencyMs: 500 },
  async run({ material, region }, { esi }) {
    const { type_id, quantity } = material as { type_id: number; quantity: number };
    const orders = await collect(
      esi.market(requireId(region, 'region')).orders.get({ order_type: 'sell', type_id }),
    );
    const prices = sellOrders(orders).map((o) => o.price);
    if (prices.length === 0) return { cost: null };
    return { cost: Math.round(Math.min(...prices) * quantity * 100) / 100 };
  },
});
