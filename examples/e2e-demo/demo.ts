/**
 * EVE Fabric — End-to-End Demo
 *
 * Starts the gateway server and walks through the full lifecycle:
 *   1. Browse the capability registry
 *   2. Create a pipeline (Market Snapshot)
 *   3. Save it via the API
 *   4. Execute it
 *   5. Publish it as a reusable composite capability
 *   6. Verify the composite appears in the registry
 *   7. Build a higher-order pipeline that depends on it
 *
 * Run: pnpm run demo
 */

import { createServer } from '../../apps/gateway/src/server.js';

const PORT = 3457;
const BASE = `http://localhost:${PORT}`;

// ── Helpers ──────────────────────────────────────────────────────────

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = text as T;
  }
  return { status: res.status, data };
}

function section(title: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
}

function json(label: string, obj: unknown): void {
  console.log(`${label}:`);
  console.log(JSON.stringify(obj, null, 2));
  console.log();
}

// ── Pipeline Definitions ────────────────────────────────────────────

const marketSnapshotPipeline = {
  id: 'market.snapshot',
  version: 1,
  name: 'Market Snapshot',
  description: 'Fetches market orders for an item in a region and aggregates price statistics',
  inputs: [
    {
      name: 'typeId',
      semanticType: 'eve.type.reference',
      description: 'Item type to query',
      required: true,
    },
    {
      name: 'regionId',
      semanticType: 'eve.region.reference',
      description: 'Market region',
      required: true,
    },
  ],
  nodes: [
    { id: 'fetchOrders', capability: { id: 'market.orders', version: '1.0.0' } },
    {
      id: 'aggregate',
      capability: { id: 'market.aggregate', version: '1.0.0' },
    },
  ],
  edges: [
    { from: 'input.typeId', to: 'fetchOrders.typeId' },
    { from: 'input.regionId', to: 'fetchOrders.regionId' },
    { from: 'fetchOrders.orders', to: 'aggregate.orders' },
  ],
  outputs: [
    { name: 'orders', source: 'fetchOrders.orders' },
    { name: 'summary', source: 'aggregate.summary' },
  ],
};

const tradeOpportunityPipeline = {
  id: 'trade.opportunity',
  version: 1,
  name: 'Trade Opportunity Finder',
  description:
    'Finds profitable trades by comparing market data across regions and factoring in route distance',
  inputs: [
    {
      name: 'sourceRegion',
      semanticType: 'eve.region.reference',
      description: 'Region to buy from',
      required: true,
    },
    {
      name: 'destinationRegion',
      semanticType: 'eve.region.reference',
      description: 'Region to sell in',
      required: true,
    },
    {
      name: 'typeId',
      semanticType: 'eve.type.reference',
      description: 'Item type to evaluate',
      required: true,
    },
  ],
  nodes: [
    {
      id: 'sourceSellOrders',
      capability: { id: 'market.orders', version: '1.0.0' },
      config: { orderType: 'sell' },
    },
    {
      id: 'destBuyOrders',
      capability: { id: 'market.orders', version: '1.0.0' },
      config: { orderType: 'buy' },
    },
    {
      id: 'routeCalc',
      capability: { id: 'route.distance', version: '1.0.0' },
    },
    {
      id: 'profitCalc',
      capability: { id: 'trade.profit.calculator', version: '1.0.0' },
    },
  ],
  edges: [
    { from: 'input.sourceRegion', to: 'sourceSellOrders.regionId' },
    { from: 'input.typeId', to: 'sourceSellOrders.typeId' },
    { from: 'input.destinationRegion', to: 'destBuyOrders.regionId' },
    { from: 'input.typeId', to: 'destBuyOrders.typeId' },
    { from: 'input.sourceRegion', to: 'routeCalc.fromRegion' },
    { from: 'input.destinationRegion', to: 'routeCalc.toRegion' },
    { from: 'sourceSellOrders.orders', to: 'profitCalc.sellOrders' },
    { from: 'destBuyOrders.orders', to: 'profitCalc.buyOrders' },
    { from: 'routeCalc.distance', to: 'profitCalc.routeDistance' },
  ],
  outputs: [
    { name: 'bestPrice', source: 'profitCalc.bestPrice' },
    { name: 'profit', source: 'profitCalc.profit' },
    { name: 'profitMargin', source: 'profitCalc.profitMargin' },
    { name: 'volume', source: 'profitCalc.volume' },
    { name: 'routeDistance', source: 'routeCalc.distance' },
  ],
};

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('EVE Fabric — End-to-End Demo');
  console.log(`Starting gateway on port ${PORT}...`);

  const server = createServer();
  server.log.level = 'error';
  await server.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`Gateway running at ${BASE}`);

  try {
    // ── Step 1: Health check ──
    section('Step 1: Health Check');
    const health = await api('GET', '/health');
    json('GET /health', health.data);

    // ── Step 2: Browse the capability registry ──
    section('Step 2: Browse Capability Registry');

    const allCaps = await api<{
      capabilities: Array<{ id: string; version: string; name: string; source: string }>;
    }>('GET', '/api/registry');
    console.log(`Found ${allCaps.data.capabilities.length} capabilities:\n`);
    for (const cap of allCaps.data.capabilities) {
      console.log(`  [${cap.source.padEnd(9)}] ${cap.id}@${cap.version}  — ${cap.name}`);
    }

    // ── Step 3: Inspect a specific capability ──
    section('Step 3: Inspect a Capability');
    const detail = await api('GET', '/api/registry/market.orders');
    json('GET /api/registry/market.orders', detail.data);

    // ── Step 4: Check dependency tree of a composite ──
    section('Step 4: Dependency Tree (composite.trade.opportunity)');
    const deps = await api('GET', '/api/registry/composite.trade.opportunity/dependencies');
    json('GET /api/registry/composite.trade.opportunity/dependencies', deps.data);

    // ── Step 5: Filter capabilities by source ──
    section('Step 5: Filter by Source');
    const esiCaps = await api<{
      capabilities: Array<{ id: string; version: string }>;
    }>('GET', '/api/registry?source=ESI');
    console.log('ESI capabilities:');
    for (const cap of esiCaps.data.capabilities) {
      console.log(`  ${cap.id}@${cap.version}`);
    }

    const derivedCaps = await api<{
      capabilities: Array<{ id: string; version: string }>;
    }>('GET', '/api/registry?source=DERIVED');
    console.log('\nDERIVED capabilities:');
    for (const cap of derivedCaps.data.capabilities) {
      console.log(`  ${cap.id}@${cap.version}`);
    }

    // ── Step 6: Save a pipeline ──
    section('Step 6: Save a Pipeline');
    const saved = await api<{ id: string; version: number; savedAt: string }>(
      'POST',
      '/api/pipelines',
      marketSnapshotPipeline,
    );
    json('POST /api/pipelines (Market Snapshot)', saved.data);
    const pipelineId = saved.data.id;

    // ── Step 7: List saved pipelines ──
    section('Step 7: List Saved Pipelines');
    const pipelines = await api('GET', '/api/pipelines');
    json('GET /api/pipelines', pipelines.data);

    // ── Step 8: Execute the pipeline ──
    section('Step 8: Execute Pipeline');
    const execResult = await api('POST', '/api/pipelines/execute', {
      pipeline: marketSnapshotPipeline,
      inputs: {
        typeId: 34,
        regionId: 10000002,
      },
    });
    json('POST /api/pipelines/execute', execResult.data);

    console.log('Execution metrics:');
    const metrics = (execResult.data as Record<string, unknown>)['metrics'] as Record<
      string,
      unknown
    >;
    console.log(`  Total duration: ${metrics['totalDurationMs']}ms`);
    console.log(`  Cache hits:     ${metrics['cacheHits']}`);
    console.log(`  Cache misses:   ${metrics['cacheMisses']}`);
    console.log(
      `  Steps completed: ${Object.keys(metrics['stepDurations'] as Record<string, unknown>).join(', ')}`,
    );

    // ── Step 9: Publish as a composite capability ──
    section('Step 9: Publish as Composite Capability');
    const publishResult = await api('POST', '/api/registry/publish', {
      capabilityId: 'custom.market.snapshot',
      version: '1.0.0',
      name: 'Custom Market Snapshot',
      description: 'A user-created composite that fetches and aggregates market data',
      pipelineId,
      pipelineVersion: 1,
      selectedInputs: ['typeId', 'regionId'],
      selectedOutputs: ['orders', 'summary'],
    });
    json('POST /api/registry/publish', publishResult.data);

    // ── Step 10: Verify the new composite is in the registry ──
    section('Step 10: Verify New Composite in Registry');
    const newCap = await api('GET', '/api/registry/custom.market.snapshot');
    json('GET /api/registry/custom.market.snapshot', newCap.data);

    // ── Step 11: Execute the trade opportunity pipeline ──
    section('Step 11: Execute Trade Opportunity Pipeline');
    const tradeResult = await api('POST', '/api/pipelines/execute', {
      pipeline: tradeOpportunityPipeline,
      inputs: {
        sourceRegion: 10000002,
        destinationRegion: 10000043,
        typeId: 34,
      },
    });
    json('POST /api/pipelines/execute (Trade Opportunity)', tradeResult.data);

    const tradeMetrics = (tradeResult.data as Record<string, unknown>)['metrics'] as Record<
      string,
      unknown
    >;
    console.log('Trade pipeline execution:');
    console.log(`  Total duration: ${tradeMetrics['totalDurationMs']}ms`);
    console.log(
      `  Parallel steps: ${Object.keys(tradeMetrics['stepDurations'] as Record<string, unknown>).join(', ')}`,
    );

    // ── Step 12: GraphQL ──
    section('Step 12: GraphQL Health Check');
    const gqlResult = await api('POST', '/graphql', {
      query: '{ health }',
    });
    json('POST /graphql', gqlResult.data);

    // ── Step 13: Clean up — delete pipeline ──
    section('Step 13: Clean Up');
    const deleteResult = await api('DELETE', `/api/pipelines/${pipelineId}`);
    console.log(`DELETE /api/pipelines/${pipelineId} → ${deleteResult.status}`);

    const afterDelete = await api('GET', '/api/pipelines');
    json('Pipelines after cleanup', afterDelete.data);

    // ── Done ──
    section('Demo Complete');
    console.log('The demo walked through the full EVE Fabric lifecycle:');
    console.log();
    console.log('  1. Browsed the capability registry (ESI, SDE, DERIVED, COMPOSITE)');
    console.log('  2. Inspected capability details and dependency trees');
    console.log('  3. Created and saved a Market Snapshot pipeline');
    console.log('  4. Executed pipelines with mock data');
    console.log('  5. Published a pipeline as a reusable composite capability');
    console.log('  6. Verified the composite appears in the registry');
    console.log('  7. Ran a multi-step Trade Opportunity pipeline');
    console.log('  8. Cleaned up (deleted saved pipeline)');
    console.log();
    console.log('For the visual designer, run: pnpm --filter @eve-fabric/gateway dev');
    console.log('Then in another terminal:    pnpm --filter @eve-fabric/designer dev');
    console.log('Open http://localhost:5173 to build pipelines visually.');
  } finally {
    await server.close();
    console.log('\nGateway stopped.');
  }
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
