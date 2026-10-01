import { defineCapability } from '@eve-fabric/kit';
import type { Blueprint, IStaticDataProvider } from '@lgriffin/esi.ts/sde';
import { requireId } from '../support.js';

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
