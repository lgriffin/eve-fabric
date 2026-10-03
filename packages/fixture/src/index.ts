/**
 * The Tranquility fixture: a small, hand-built slice of New Eden for tests
 * and the question bank. Ids, names and security values match Tranquility;
 * prices, volumes and the route are representative, not a recording.
 *
 * ESI is served by ESI.ts's own mock transport, so every request runs through
 * the real ESI.ts pipeline (URL building, pagination, validation) and only
 * the network is replaced (constitution: BDD mocks only at the transport seam).
 */
import { createEsi, identityFromToken, type Esi, type Identity } from '@lgriffin/esi.ts/client';
import { createMockTransport, type MockTransport } from '@lgriffin/esi.ts/testing';
import { MemorySdeProvider, SdeTestDataFactory as F } from '@lgriffin/esi.ts/sde';
import type { IStaticDataProvider, MemorySdeData } from '@lgriffin/esi.ts/sde';

export const TYPE = {
  tritanium: 34,
  pyerite: 35,
  mexallon: 36,
  isogen: 37,
  rifter: 587,
  rifterBlueprint: 691,
} as const;

export const REGION = {
  theForge: 10000002,
  domain: 10000043,
} as const;

export const SYSTEM = {
  jita: 30000142,
  perimeter: 30000144,
  urlen: 30000139,
  sivala: 30003071,
  amarr: 30002187,
} as const;

export const STATION = {
  jita44: 60003760,
  perimeterTtt: 60012667,
  amarrEmperor: 60008494,
} as const;

function system(
  id: number,
  name: string,
  regionId: number,
  securityStatus: number,
): ReturnType<typeof F.createSolarSystem> {
  return F.createSolarSystem({ systemId: id, name, regionId, securityStatus });
}

/** The fixture's static data, as ESI.ts's in-memory provider takes it. */
export function tranquilitySdeData(): MemorySdeData {
  return {
    types: [
      F.createEveType({ typeId: TYPE.tritanium, name: 'Tritanium', groupId: 18, volume: 0.01 }),
      F.createEveType({ typeId: TYPE.pyerite, name: 'Pyerite', groupId: 18, volume: 0.01 }),
      F.createEveType({ typeId: TYPE.mexallon, name: 'Mexallon', groupId: 18, volume: 0.01 }),
      F.createEveType({ typeId: TYPE.isogen, name: 'Isogen', groupId: 18, volume: 0.01 }),
      F.createEveType({ typeId: TYPE.rifter, name: 'Rifter', groupId: 25, volume: 27289 }),
      F.createEveType({
        typeId: TYPE.rifterBlueprint,
        name: 'Rifter Blueprint',
        groupId: 105,
        volume: 0.01,
      }),
    ],
    regions: [
      F.createRegion({ regionId: REGION.theForge, name: 'The Forge' }),
      F.createRegion({ regionId: REGION.domain, name: 'Domain' }),
    ],
    solarSystems: [
      system(SYSTEM.jita, 'Jita', REGION.theForge, 0.9459),
      system(SYSTEM.perimeter, 'Perimeter', REGION.theForge, 0.9549),
      system(SYSTEM.urlen, 'Urlen', REGION.theForge, 0.9584),
      system(SYSTEM.sivala, 'Sivala', REGION.domain, 0.3537),
      system(SYSTEM.amarr, 'Amarr', REGION.domain, 1.0),
    ],
    npcStations: [
      F.createNpcStation({ stationId: STATION.jita44, solarSystemId: SYSTEM.jita }),
      F.createNpcStation({ stationId: STATION.perimeterTtt, solarSystemId: SYSTEM.perimeter }),
      F.createNpcStation({ stationId: STATION.amarrEmperor, solarSystemId: SYSTEM.amarr }),
    ],
    blueprints: [
      F.createBlueprint({
        blueprintTypeId: TYPE.rifterBlueprint,
        maxProductionLimit: 300,
        activities: {
          manufacturing: {
            time: 6000,
            materials: [
              { typeId: TYPE.tritanium, quantity: 32000 },
              { typeId: TYPE.pyerite, quantity: 6000 },
              { typeId: TYPE.mexallon, quantity: 2500 },
              { typeId: TYPE.isogen, quantity: 500 },
            ],
            products: [{ typeId: TYPE.rifter, quantity: 1 }],
          },
        },
      }),
    ],
  };
}

export function tranquilitySde(): IStaticDataProvider {
  return new MemorySdeProvider(tranquilitySdeData());
}

interface OrderSpec {
  readonly id: number;
  readonly type: number;
  readonly station: number;
  readonly system: number;
  readonly price: number;
  readonly buy?: boolean;
  readonly volume?: number;
}

function order(spec: OrderSpec): Record<string, unknown> {
  return {
    order_id: spec.id,
    type_id: spec.type,
    location_id: spec.station,
    system_id: spec.system,
    price: spec.price,
    is_buy_order: spec.buy ?? false,
    volume_remain: spec.volume ?? 1_000_000,
    volume_total: spec.volume ?? 1_000_000,
    issued: '2026-09-30T12:00:00Z',
    duration: 90,
    range: spec.buy === true ? 'station' : 'region',
    min_volume: 1,
  };
}

/** Sell and buy orders per region and type. Prices are representative. */
export const ORDERS: Readonly<Record<number, Readonly<Record<number, readonly OrderSpec[]>>>> = {
  [REGION.theForge]: {
    [TYPE.tritanium]: [
      { id: 7001, type: 34, station: STATION.jita44, system: SYSTEM.jita, price: 4.12 },
      { id: 7002, type: 34, station: STATION.perimeterTtt, system: SYSTEM.perimeter, price: 3.98 },
      { id: 7003, type: 34, station: STATION.jita44, system: SYSTEM.jita, price: 3.71, buy: true },
    ],
    [TYPE.pyerite]: [
      { id: 7011, type: 35, station: STATION.jita44, system: SYSTEM.jita, price: 9.5 },
      { id: 7012, type: 35, station: STATION.jita44, system: SYSTEM.jita, price: 8.9, buy: true },
    ],
    [TYPE.mexallon]: [
      { id: 7021, type: 36, station: STATION.jita44, system: SYSTEM.jita, price: 61.0 },
    ],
    [TYPE.isogen]: [
      { id: 7031, type: 37, station: STATION.jita44, system: SYSTEM.jita, price: 78.0 },
    ],
  },
  [REGION.domain]: {
    [TYPE.tritanium]: [
      { id: 8001, type: 34, station: STATION.amarrEmperor, system: SYSTEM.amarr, price: 4.6 },
      {
        id: 8002,
        type: 34,
        station: STATION.amarrEmperor,
        system: SYSTEM.amarr,
        price: 4.4,
        buy: true,
      },
    ],
  },
};

/** The route ESI answers for Jita to Amarr. */
export const JITA_TO_AMARR = [
  SYSTEM.jita,
  SYSTEM.perimeter,
  SYSTEM.urlen,
  SYSTEM.sivala,
  SYSTEM.amarr,
] as const;

/** One incursion over The Forge and Domain: two high-sec systems and one low-sec. */
export const INCURSIONS = [
  {
    constellation_id: 20000020,
    faction_id: 500019,
    has_boss: true,
    infested_solar_systems: [SYSTEM.urlen, SYSTEM.sivala, SYSTEM.perimeter],
    influence: 0.4,
    staging_solar_system_id: SYSTEM.urlen,
    state: 'established',
    type: 'Incursion',
  },
] as const;

export const CHARACTER = {
  ava: 2112000001,
  bo: 2112000002,
} as const;

const NAMES: Readonly<Record<number, string>> = {
  [CHARACTER.ava]: 'Ava Trader',
  [CHARACTER.bo]: 'Bo Miner',
};

function entry(id: number, date: string, refType: string, amount: number) {
  return { id, date, ref_type: refType, amount, balance: 0, description: refType };
}

/**
 * Each character's wallet journal. The fixture clock reads 2026-10-01, so
 * the week runs from 2026-09-24. Ava spent most on market transactions
 * (2,000,000 ISK); an older contract does not count. Bo spent most on
 * industry job tax.
 */
export const JOURNALS: Readonly<Record<number, readonly Record<string, unknown>[]>> = {
  [CHARACTER.ava]: [
    entry(1, '2026-09-30T18:00:00Z', 'market_transaction', -800_000),
    entry(2, '2026-09-30T17:00:00Z', 'brokers_fee', -50_000),
    entry(3, '2026-09-29T12:00:00Z', 'market_transaction', -1_200_000),
    entry(4, '2026-09-28T12:00:00Z', 'bounty_prizes', 3_000_000),
    entry(5, '2026-09-01T12:00:00Z', 'contract_price', -5_000_000),
  ],
  [CHARACTER.bo]: [
    entry(11, '2026-09-28T09:00:00Z', 'industry_job_tax', -300_000),
    entry(12, '2026-09-27T09:00:00Z', 'planetary_import_tax', -100_000),
  ],
};

function ownOrder(id: number, type: number, price: number, buy = false) {
  return {
    order_id: id,
    type_id: type,
    region_id: REGION.theForge,
    location_id: STATION.jita44,
    price,
    volume_remain: 1000,
    volume_total: 1000,
    issued: '2026-09-30T12:00:00Z',
    duration: 90,
    range: buy ? 'station' : 'region',
    is_corporation: false,
    ...(buy ? { is_buy_order: true, min_volume: 1, escrow: 0 } : {}),
  };
}

/**
 * Ava's open orders in Jita. A rival sells Tritanium below her 4.40 and
 * buys it above her 3.50; nobody beats her Pyerite at 9.00.
 */
export const CHARACTER_ORDERS: Readonly<Record<number, readonly Record<string, unknown>[]>> = {
  [CHARACTER.ava]: [
    ownOrder(9001, TYPE.tritanium, 4.4),
    ownOrder(9002, TYPE.pyerite, 9.0),
    ownOrder(9003, TYPE.tritanium, 3.5, true),
  ],
  [CHARACTER.bo]: [],
};

/** A mock transport answering the fixture's ESI routes. */
export function tranquilityTransport(): MockTransport {
  const transport = createMockTransport();
  for (const [region, byType] of Object.entries(ORDERS)) {
    for (const [type, specs] of Object.entries(byType)) {
      transport.respond({
        method: 'GET',
        path: new RegExp(`/markets/${region}/orders/?\\?(?=.*type_id=${type}(&|$))`),
        headers: { 'x-pages': '1' },
        body: specs.map(order),
      });
    }
  }
  // Any other type in a known region has no orders.
  transport.respond({
    method: 'GET',
    path: /\/markets\/\d+\/orders/,
    headers: { 'x-pages': '1' },
    body: [],
  });
  transport.respond({
    method: 'POST',
    path: `/route/${SYSTEM.jita}/${SYSTEM.amarr}`,
    body: { route: [...JITA_TO_AMARR] },
  });
  transport.respond({ method: 'GET', path: '/incursions', body: INCURSIONS });
  for (const [id, name] of Object.entries(NAMES)) {
    transport.respond({
      method: 'GET',
      path: `/characters/${id}/wallet/journal`,
      headers: { 'x-pages': '1' },
      body: JOURNALS[Number(id)],
    });
    transport.respond({
      method: 'GET',
      path: `/characters/${id}/orders`,
      body: CHARACTER_ORDERS[Number(id)],
    });
    transport.respond({
      method: 'GET',
      path: `/characters/${id}`,
      body: {
        name,
        corporation_id: 1000125,
        birthday: '2015-03-24T11:37:00Z',
        gender: 'female',
        race_id: 1,
        bloodline_id: 1,
      },
    });
  }
  transport.respond({
    method: 'POST',
    path: '/universe/ids',
    body: {
      characters: Object.entries(NAMES).map(([id, name]) => ({ id: Number(id), name })),
    },
  });
  transport.respond({
    method: 'POST',
    path: `/route/${SYSTEM.amarr}/${SYSTEM.jita}`,
    body: { route: [...JITA_TO_AMARR].reverse() },
  });
  return transport;
}

export interface TranquilityEsi {
  readonly esi: Esi;
  readonly transport: MockTransport;
}

/** ESI.ts's real runtime over the fixture's mock transport. */
export function tranquilityEsi(): TranquilityEsi {
  const transport = tranquilityTransport();
  const esi = createEsi({
    userAgent: 'eve-fabric-tests/0.2 (+https://github.com/lgriffin/eve-fabric)',
    transport,
    enableETagCache: false,
    logLevel: 'fatal',
  });
  return { esi, transport };
}

/** A character as a fabric caller: its id, the scopes its token holds, and ESI.ts's identity. */
export interface FixtureCharacter {
  readonly characterId: number;
  readonly scopes: readonly string[];
  readonly esi: Identity;
}

/** A fixture character whose token holds `scopes`. The token is a placeholder the mock accepts. */
export function tranquilityCharacter(
  characterId: number,
  scopes: readonly string[],
): FixtureCharacter {
  return { characterId, scopes, esi: identityFromToken(`fixture-token-${characterId}`) };
}
