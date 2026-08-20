/**
 * EVE Fabric — Live ESI + SDE Demo
 *
 * Demonstrates the full adapter layer using both live ESI API calls and
 * SDE static data. Shows how the two data sources complement each other:
 * SDE provides item/region/system metadata, ESI provides live market data
 * and route calculations.
 *
 * NOTE: The SDE adapter uses an inline provider here because importing
 * @lgriffin/esi.ts/sde under tsx pulls in adm-zip (CJS) which breaks
 * ESM mode. The gateway server uses the real MemorySdeProvider under
 * plain Node.js where CJS interop works fine. Once ESI.ts exports
 * MemorySdeProvider separately from SdeDataProvider/adm-zip, this
 * example can switch to createMemorySdeProvider().
 * See: https://github.com/lgriffin/ESI.ts/issues/194
 *
 * Run: npx tsx examples/esi-live.ts
 *      — or —
 *      pnpm run demo:esi
 */
import { EsiAdapter, EsiClient } from '@eve-fabric/esi-adapter';
import { SdeAdapter } from '@eve-fabric/sde-adapter';
import type { CapabilityDefinition, SourceAdapterResult } from '@eve-fabric/domain';

// Inline SDE data — matches the EveType/Region/SolarSystem shapes from
// @lgriffin/esi.ts exactly, so the SDE adapter works identically to the
// real MemorySdeProvider used in the gateway server.

const TYPES = [
  {
    typeId: 34,
    name: 'Tritanium',
    groupId: 18,
    mass: 0,
    volume: 0.01,
    portionSize: 1,
    published: true,
    marketGroupId: 1857,
    iconId: 22,
    description:
      'The most abundant mineral in New Eden, Tritanium is the basic building block of most structures and ships.',
    packagedVolume: null,
    radius: null,
    graphicId: null,
    soundId: null,
    raceId: null,
    basePrice: null,
    capacity: null,
    isRepackable: null,
  },
  {
    typeId: 35,
    name: 'Pyerite',
    groupId: 18,
    mass: 0,
    volume: 0.01,
    portionSize: 1,
    published: true,
    marketGroupId: 1857,
    iconId: 22,
    description: 'A versatile mineral commonly used in electronics and armor plating.',
    packagedVolume: null,
    radius: null,
    graphicId: null,
    soundId: null,
    raceId: null,
    basePrice: null,
    capacity: null,
    isRepackable: null,
  },
  {
    typeId: 36,
    name: 'Mexallon',
    groupId: 18,
    mass: 0,
    volume: 0.01,
    portionSize: 1,
    published: true,
    marketGroupId: 1857,
    iconId: 22,
    description: 'A light, flexible mineral used in ship hulls and electronic components.',
    packagedVolume: null,
    radius: null,
    graphicId: null,
    soundId: null,
    raceId: null,
    basePrice: null,
    capacity: null,
    isRepackable: null,
  },
  {
    typeId: 587,
    name: 'Rifter',
    groupId: 25,
    mass: 1067000,
    volume: 27289,
    portionSize: 1,
    published: true,
    marketGroupId: 1377,
    iconId: 0,
    description:
      'The Rifter is a very powerful combat frigate and can easily tackle the best frigates out there.',
    packagedVolume: null,
    radius: null,
    graphicId: null,
    soundId: null,
    raceId: null,
    basePrice: null,
    capacity: null,
    isRepackable: null,
  },
];

const REGIONS = [
  {
    regionId: 10000002,
    name: 'The Forge',
    constellationIDs: [] as number[],
    description: '',
    factionId: 0,
    nebulaId: 0,
    position: { x: 0, y: 0, z: 0 },
    wormholeClassId: 0,
  },
  {
    regionId: 10000043,
    name: 'Domain',
    constellationIDs: [] as number[],
    description: '',
    factionId: 0,
    nebulaId: 0,
    position: { x: 0, y: 0, z: 0 },
    wormholeClassId: 0,
  },
  {
    regionId: 10000032,
    name: 'Sinq Laison',
    constellationIDs: [] as number[],
    description: '',
    factionId: 0,
    nebulaId: 0,
    position: { x: 0, y: 0, z: 0 },
    wormholeClassId: 0,
  },
  {
    regionId: 10000030,
    name: 'Heimatar',
    constellationIDs: [] as number[],
    description: '',
    factionId: 0,
    nebulaId: 0,
    position: { x: 0, y: 0, z: 0 },
    wormholeClassId: 0,
  },
];

const SOLAR_SYSTEMS = [
  {
    systemId: 30000142,
    name: 'Jita',
    constellationId: 20000020,
    regionId: 10000002,
    securityStatus: 0.9459,
    border: false,
    hub: true,
    international: false,
    luminosity: 0,
    planetIDs: [] as number[],
    position: { x: 0, y: 0, z: 0 },
    position2D: { x: 0, y: 0 },
    radius: 0,
    regional: false,
    securityClass: 'A',
    starId: 0,
    stargateIDs: [] as number[],
    corridor: null,
    fringe: null,
    wormholeClassId: null,
    visualEffect: null,
  },
  {
    systemId: 30002187,
    name: 'Amarr',
    constellationId: 20000322,
    regionId: 10000043,
    securityStatus: 1.0,
    border: false,
    hub: true,
    international: false,
    luminosity: 0,
    planetIDs: [] as number[],
    position: { x: 0, y: 0, z: 0 },
    position2D: { x: 0, y: 0 },
    radius: 0,
    regional: false,
    securityClass: 'A',
    starId: 0,
    stargateIDs: [] as number[],
    corridor: null,
    fringe: null,
    wormholeClassId: null,
    visualEffect: null,
  },
  {
    systemId: 30002659,
    name: 'Dodixie',
    constellationId: 20000389,
    regionId: 10000032,
    securityStatus: 0.8709,
    border: false,
    hub: true,
    international: false,
    luminosity: 0,
    planetIDs: [] as number[],
    position: { x: 0, y: 0, z: 0 },
    position2D: { x: 0, y: 0 },
    radius: 0,
    regional: false,
    securityClass: 'B',
    starId: 0,
    stargateIDs: [] as number[],
    corridor: null,
    fringe: null,
    wormholeClassId: null,
    visualEffect: null,
  },
  {
    systemId: 30002544,
    name: 'Rens',
    constellationId: 20000373,
    regionId: 10000030,
    securityStatus: 0.8969,
    border: false,
    hub: true,
    international: false,
    luminosity: 0,
    planetIDs: [] as number[],
    position: { x: 0, y: 0, z: 0 },
    position2D: { x: 0, y: 0 },
    radius: 0,
    regional: false,
    securityClass: 'B',
    starId: 0,
    stargateIDs: [] as number[],
    corridor: null,
    fringe: null,
    wormholeClassId: null,
    visualEffect: null,
  },
];

function createInlineSdeProvider() {
  return {
    getType: (typeId: number) => TYPES.find((t) => t.typeId === typeId) ?? null,
    searchTypesByName: (query: string, limit = 10) =>
      TYPES.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())).slice(0, limit),
    getRegion: (regionId: number) => REGIONS.find((r) => r.regionId === regionId) ?? null,
    getAllRegions: () => [...REGIONS],
    getSolarSystem: (systemId: number) =>
      SOLAR_SYSTEMS.find((s) => s.systemId === systemId) ?? null,
    searchSolarSystemsByName: (query: string, limit = 10) =>
      SOLAR_SYSTEMS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).slice(
        0,
        limit,
      ),
    getVersion: () => ({ version: 'inline-demo', buildDate: new Date().toISOString() }),
    close: () => {},
  };
}

function makeCapability(id: string, source: 'ESI' | 'SDE' | 'DERIVED'): CapabilityDefinition {
  return {
    id: id as never,
    version: '1.0.0' as never,
    name: id,
    description: id,
    inputs: new Map(),
    outputs: new Map(),
    source: source as never,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 300,
      stalePermitted: false,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 200, esiCallCount: source === 'ESI' ? 1 : 0 },
  };
}

function section(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function provenance(result: SourceAdapterResult): string {
  const p = result.provenance;
  const time = p.retrievedAt ?? p.calculatedAt ?? 'N/A';
  return `source=${p.source}, cached=${p.cached}, at=${time instanceof Date ? time.toISOString() : time}`;
}

async function main(): Promise<void> {
  console.log('EVE Fabric — Live ESI + SDE Demo');
  console.log('Combining static game data (SDE) with live market data (ESI)\n');

  const client = new EsiClient();
  const esiAdapter = new EsiAdapter({ client });
  const sdeProvider = createInlineSdeProvider();
  const sdeAdapter = new SdeAdapter({ provider: sdeProvider as never });

  // -- Step 1: Resolve items from SDE --
  section('Step 1: SDE — Resolve Items by Name');

  const minerals = ['Tritanium', 'Pyerite', 'Mexallon'];
  const typeCap = makeCapability('universe.resolve.type', 'SDE');

  for (const name of minerals) {
    const result = await sdeAdapter.execute(typeCap, new Map([['query', name]]));
    const type = result.data as Record<string, unknown>;
    console.log(
      `  ${(type['name'] as string).padEnd(12)} typeId=${type['typeId']}  ` +
        `vol=${type['volume']}m3  group=${type['groupId']}`,
    );
  }

  const rifterResult = await sdeAdapter.execute(typeCap, new Map([['query', 'Rifter']]));
  const rifter = rifterResult.data as Record<string, unknown>;
  console.log(
    `  ${(rifter['name'] as string).padEnd(12)} typeId=${rifter['typeId']}  ` +
      `vol=${rifter['volume']}m3  mass=${(rifter['mass'] as number).toLocaleString()}kg`,
  );
  console.log(`\n  Provenance: ${provenance(rifterResult)}`);

  // -- Step 2: Resolve trade hub systems from SDE --
  section('Step 2: SDE — Resolve Trade Hub Systems');

  const systemCap = makeCapability('universe.resolve.solar.system', 'SDE');
  const hubs = ['Jita', 'Amarr', 'Dodixie', 'Rens'];
  const hubSystems: Array<{ name: string; id: number; security: number; regionId: number }> = [];

  for (const hub of hubs) {
    const result = await sdeAdapter.execute(systemCap, new Map([['query', hub]]));
    const sys = result.data as Record<string, unknown>;
    const entry = {
      name: sys['name'] as string,
      id: sys['systemId'] as number,
      security: sys['securityStatus'] as number,
      regionId: sys['regionId'] as number,
    };
    hubSystems.push(entry);
    console.log(
      `  ${entry.name.padEnd(10)} systemId=${entry.id}  ` +
        `security=${entry.security.toFixed(4)}  regionId=${entry.regionId}`,
    );
  }

  // -- Step 3: Resolve regions from SDE --
  section('Step 3: SDE — Resolve Regions');

  const regionCap = makeCapability('universe.resolve.region', 'SDE');
  for (const hub of hubSystems) {
    const result = await sdeAdapter.execute(regionCap, new Map([['query', hub.regionId]]));
    const region = result.data as Record<string, unknown>;
    console.log(`  ${hub.name.padEnd(10)} -> ${region['name']} (${region['regionId']})`);
  }

  // -- Step 4: Live ESI — Market history for Tritanium --
  section('Step 4: ESI — Live Market History for Tritanium');

  console.log('  Fetching from esi.evetech.net...');
  const history = await client.market.getMarketHistory(10000002, 34);
  const recent = history.slice(-5);
  console.log(`  ${history.length} days of history (showing last 5):\n`);
  for (const day of recent) {
    console.log(
      `  ${day.date}  avg=${day.average.toFixed(2)} ISK  ` +
        `vol=${day.volume.toLocaleString()}  orders=${day.order_count}`,
    );
  }

  // -- Step 5: Live ESI — Global prices for our SDE minerals --
  section('Step 5: ESI — Live Prices for SDE Minerals');

  console.log('  Fetching global average prices...');
  const prices = await client.market.getMarketPrices();
  for (const name of minerals) {
    const typeResult = await sdeAdapter.execute(typeCap, new Map([['query', name]]));
    const typeData = typeResult.data as Record<string, unknown>;
    const typeId = typeData['typeId'] as number;
    const price = prices.find((p) => p.type_id === typeId);
    console.log(
      `  ${name.padEnd(12)} (SDE typeId=${typeId})  ->  ` +
        `avg=${price?.average_price?.toFixed(2) ?? 'N/A'} ISK  ` +
        `adjusted=${price?.adjusted_price?.toFixed(2) ?? 'N/A'} ISK  [ESI live]`,
    );
  }

  // -- Step 6: Live ESI — Route between trade hubs --
  section('Step 6: ESI — Routes Between Trade Hubs (via Adapter)');

  const routeCap = makeCapability('route.distance', 'ESI');
  const jita = hubSystems[0];
  for (const dest of hubSystems.slice(1)) {
    const result = await esiAdapter.execute(
      routeCap,
      new Map<string, unknown>([
        ['origin', jita.id],
        ['destination', dest.id],
      ]),
    );
    console.log(
      `  ${jita.name} -> ${dest.name.padEnd(10)} ${String(result.data).padStart(3)} jumps  ` +
        `[${provenance(result)}]`,
    );
  }

  // -- Step 7: Live ESI — System details via adapter --
  section('Step 7: ESI — Live System Details (via Adapter)');

  const universeCap = makeCapability('universe.resolve.location', 'ESI');
  const jitaResult = await esiAdapter.execute(
    universeCap,
    new Map<string, unknown>([['location', 30000142]]),
  );
  const jitaLive = jitaResult.data as Record<string, unknown>;
  console.log('  Jita (live from ESI):');
  console.log(`    name:              ${jitaLive['name']}`);
  console.log(`    security_status:   ${jitaLive['security_status']}`);
  console.log(`    constellation_id:  ${jitaLive['constellation_id']}`);
  console.log(`    star_id:           ${jitaLive['star_id']}`);
  console.log(
    `    stations:          ${(jitaLive['stations'] as number[] | undefined)?.length ?? 0} stations`,
  );
  console.log(
    `    stargates:         ${(jitaLive['stargates'] as number[] | undefined)?.length ?? 0} stargates`,
  );

  // -- Summary --
  section('Summary: SDE + ESI Working Together');
  console.log('  SDE (static data via inline provider, same shape as MemorySdeProvider):');
  console.log('    - Resolved item types by name -> typeId, volume, description');
  console.log('    - Resolved solar systems by name -> systemId, security, region');
  console.log('    - Resolved regions by ID -> region name');
  console.log();
  console.log('  ESI (live data via EsiClient):');
  console.log('    - Market history for Tritanium -> daily price/volume');
  console.log('    - Global market prices -> avg/adjusted prices for all types');
  console.log('    - Route calculations -> jump distances between systems');
  console.log('    - System details -> live constellation, stations, stargates');
  console.log();
  console.log('  The adapter layer wraps both data sources behind the same');
  console.log('  SourceAdapter interface, so the pipeline executor can mix');
  console.log('  SDE lookups and ESI calls in a single execution plan.');
  console.log();
  console.log('  NOTE: The gateway server uses the real MemorySdeProvider from');
  console.log('  @lgriffin/esi.ts/sde under plain Node.js. This example uses an');
  console.log('  inline provider because tsx ESM mode cannot import adm-zip (CJS).');
  console.log('  See: https://github.com/lgriffin/esi.ts — separate MemorySdeProvider export\n');
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
