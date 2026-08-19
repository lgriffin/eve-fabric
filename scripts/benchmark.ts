import { CapabilityCatalog } from '@eve-fabric/domain';
import { compile } from '@eve-fabric/compiler';
import type { PipelineDefinition } from '@eve-fabric/compiler';
import { planExecution } from '@eve-fabric/planner';

function marketOrdersDef() {
  return {
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders for a region',
    inputs: {
      regionId: { name: 'regionId', semanticType: 'eve.region.reference', required: true },
    },
    outputs: {
      orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
  };
}

function priceAggregatorDef() {
  return {
    id: 'price.aggregator',
    version: 1,
    name: 'Price Aggregator',
    description: 'Aggregate orders into price',
    inputs: {
      orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
    },
    outputs: {
      price: { name: 'price', semanticType: 'eve.currency.isk', required: true },
    },
    source: 'DERIVED' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
  };
}

function sdeTypeLookupDef() {
  return {
    id: 'sde.types.lookup',
    version: 1,
    name: 'SDE Type Lookup',
    description: 'Look up type info from SDE',
    inputs: {
      typeId: { name: 'typeId', semanticType: 'eve.type.reference', required: true },
    },
    outputs: {
      typeName: { name: 'typeName', semanticType: 'eve.type.name', required: true },
    },
    source: 'SDE' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
  };
}

function tradeOpportunityPipeline(): PipelineDefinition {
  return {
    id: 'trade-opportunity',
    version: 1,
    name: 'Trade Opportunity',
    description: 'Find trade opportunities',
    nodes: [
      { id: 'fetch-orders', capability: { id: 'market.orders', version: 1 } },
      { id: 'aggregate', capability: { id: 'price.aggregator', version: 1 } },
      { id: 'lookup-type', capability: { id: 'sde.types.lookup', version: 1 } },
    ],
    edges: [
      { from: 'input.regionId', to: 'fetch-orders.regionId' },
      { from: 'fetch-orders.orders', to: 'aggregate.orders' },
      { from: 'input.typeId', to: 'lookup-type.typeId' },
    ],
    inputs: [
      { name: 'regionId', semanticType: 'eve.region.reference', required: true },
      { name: 'typeId', semanticType: 'eve.type.reference', required: true },
    ],
    outputs: [
      { name: 'price', source: 'aggregate.price' },
      { name: 'typeName', source: 'lookup-type.typeName' },
      { name: 'orders', source: 'fetch-orders.orders' },
    ],
  };
}

function benchmark(name: string, fn: () => void, iterations: number): { avgMs: number; minMs: number; maxMs: number } {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(`  ${name}: avg=${avg.toFixed(3)}ms  min=${min.toFixed(3)}ms  max=${max.toFixed(3)}ms  (${iterations} iterations)`);
  return { avgMs: avg, minMs: min, maxMs: max };
}

const ITERATIONS = 1000;

console.log('EVE Schema Gateway - Performance Benchmark');
console.log('='.repeat(50));

const catalog = new CapabilityCatalog();
catalog.register(marketOrdersDef());
catalog.register(priceAggregatorDef());
catalog.register(sdeTypeLookupDef());

const pipeline = tradeOpportunityPipeline();

console.log('\nCompilation:');
const compileResult = benchmark('compile()', () => compile(pipeline, catalog), ITERATIONS);

const result = compile(pipeline, catalog);
if (!result.success || !result.plan) {
  console.error('Compilation failed:', result.diagnostics);
  process.exit(1);
}

console.log('\nPlan optimization:');
const planResult = benchmark('planExecution()', () => planExecution(result.plan!), ITERATIONS);

console.log('\nEnd-to-end (compile + plan):');
const e2eResult = benchmark('compile + plan', () => {
  const r = compile(pipeline, catalog);
  if (r.plan) planExecution(r.plan);
}, ITERATIONS);

console.log('\n' + '='.repeat(50));
console.log('Summary:');
console.log(`  Compile:   ${compileResult.avgMs.toFixed(3)}ms avg`);
console.log(`  Plan:      ${planResult.avgMs.toFixed(3)}ms avg`);
console.log(`  End-to-end: ${e2eResult.avgMs.toFixed(3)}ms avg`);
console.log(`  Steps: ${result.plan.steps.length}, Parallel groups: ${result.plan.parallelGroups.length}`);
