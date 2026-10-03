import { describe, expect, it } from 'vitest';
import {
  CHARACTER,
  JITA_TO_AMARR,
  REGION,
  SYSTEM,
  TYPE,
  tranquilityCharacter,
  tranquilityEsi,
  tranquilitySde,
  tranquilitySdeData,
} from '../src/index.js';

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
}

describe('the Tranquility fixture', () => {
  it('names every type, region and system its constants refer to', () => {
    const data = tranquilitySdeData();
    expect(data.types.map((t) => t.typeId)).toEqual(expect.arrayContaining(Object.values(TYPE)));
    expect(data.regions.map((r) => r.regionId)).toEqual(Object.values(REGION));
    expect(data.solarSystems.map((s) => s.systemId)).toEqual(Object.values(SYSTEM));
    expect(tranquilitySde().getType(TYPE.tritanium)).toMatchObject({ name: 'Tritanium' });
  });

  it('serves market orders and the Jita to Amarr route through ESI.ts', async () => {
    const { esi } = tranquilityEsi();
    const orders = await collect(
      esi.public.market(REGION.theForge).orders.get({ order_type: 'all', type_id: TYPE.tritanium }),
    );
    expect(orders.map((o) => o.order_id)).toEqual([7001, 7002, 7003]);
    const { route } = await esi.public.route(SYSTEM.jita, SYSTEM.amarr).post({});
    expect(route).toEqual([...JITA_TO_AMARR]);
  });

  it('gives a character an identity over a placeholder token', () => {
    const ava = tranquilityCharacter(CHARACTER.ava, ['esi-wallet.read_character_wallet.v1']);
    expect(ava.characterId).toBe(CHARACTER.ava);
    expect(ava.scopes).toHaveLength(1);
  });
});
