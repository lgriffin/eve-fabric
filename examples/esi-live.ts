/**
 * EVE Fabric — Live ESI Demo
 *
 * Demonstrates real ESI API calls through the adapter layer and direct client.
 * Uses only public ESI endpoints (no auth required).
 *
 * Run: npx tsx examples/esi-live.ts
 */
import { EsiClient } from '@lgriffin/esi.ts';
import { EsiAdapter } from '@eve-fabric/esi-adapter';
import type { CapabilityDefinition } from '@eve-fabric/domain';

function makeCapability(id: string, source: 'ESI'): CapabilityDefinition {
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
    cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
  };
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

async function main(): Promise<void> {
  console.log('EVE Fabric — Live ESI Demo');
  console.log('Calling real EVE Online ESI public endpoints via @lgriffin/esi.ts\n');

  const client = new EsiClient();
  const adapter = new EsiAdapter({ client });

  // 1. Market History — Tritanium in The Forge (type-specific, fast)
  section('Market History: Tritanium (34) in The Forge (10000002)');
  console.log('  Fetching via EsiClient.market.getMarketHistory()...');
  const history = await client.market.getMarketHistory(10000002, 34);
  const recent = history.slice(-5);
  console.log(`  Total entries: ${history.length} (showing last 5 days)\n`);
  for (const day of recent) {
    console.log(
      `  ${day.date}  avg=${day.average.toFixed(2)} ISK  ` +
        `high=${day.highest.toFixed(2)}  low=${day.lowest.toFixed(2)}  ` +
        `vol=${day.volume.toLocaleString()}  orders=${day.order_count}`,
    );
  }

  // 2. Global market prices
  section('Global Market Prices (sample)');
  console.log('  Fetching via EsiClient.market.getMarketPrices()...');
  const prices = await client.market.getMarketPrices();
  const tritanium = prices.find((p) => p.type_id === 34);
  const pyerite = prices.find((p) => p.type_id === 35);
  const mexallon = prices.find((p) => p.type_id === 36);
  console.log(`  Total types with prices: ${prices.length}\n`);
  for (const [name, item] of Object.entries({
    Tritanium: tritanium,
    Pyerite: pyerite,
    Mexallon: mexallon,
  })) {
    if (item) {
      console.log(
        `  ${name.padEnd(12)} avg=${item.average_price?.toFixed(2) ?? 'N/A'} ISK  ` +
          `adjusted=${item.adjusted_price?.toFixed(2) ?? 'N/A'} ISK`,
      );
    }
  }

  // 3. Route distance via adapter
  section('Route Distance: Jita (30000142) → Amarr (30002187)');
  console.log('  Fetching via EsiAdapter.execute("route.distance")...');
  const routeCap = makeCapability('route.distance', 'ESI');
  const routeResult = await adapter.execute(
    routeCap,
    new Map<string, unknown>([
      ['origin', 30000142],
      ['destination', 30002187],
    ]),
  );
  console.log(`  Distance: ${routeResult.data} jumps`);
  console.log(`  Provenance: source=${routeResult.provenance.source}`);

  // 4. Universe system info via adapter
  section('Universe: Resolve Jita (30000142)');
  console.log('  Fetching via EsiAdapter.execute("universe.resolve.location")...');
  const universeCap = makeCapability('universe.resolve.location', 'ESI');
  const universeResult = await adapter.execute(
    universeCap,
    new Map<string, unknown>([['location', 30000142]]),
  );
  const system = universeResult.data as Record<string, unknown>;
  console.log(`  Name:           ${system['name']}`);
  console.log(`  Security:       ${system['security_status']}`);
  console.log(`  Constellation:  ${system['constellation_id']}`);
  console.log(`  Provenance:     source=${universeResult.provenance.source}`);

  // Summary
  section('Summary');
  console.log('  All ESI calls returned real data from esi.evetech.net:\n');
  console.log('    EsiClient direct:');
  console.log('      market.getMarketHistory()   → daily price/volume data');
  console.log('      market.getMarketPrices()    → global average prices');
  console.log('    EsiAdapter (SourceAdapter):');
  console.log('      route.distance              → jump count via route API');
  console.log('      universe.resolve.location   → system info from universe API');
  console.log('\n  The adapter layer wraps @lgriffin/esi.ts and produces');
  console.log('  SourceAdapterResult with provenance tracking for the');
  console.log('  pipeline executor.\n');
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
