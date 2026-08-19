/**
 * Performance benchmark for EVE Schema Gateway pipeline operations.
 *
 * Run: npx tsx examples/benchmark.ts
 */
import { performance } from 'node:perf_hooks';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
} from '@eve-fabric/domain';
import { compile } from '@eve-fabric/compiler';
import { planExecution } from '@eve-fabric/planner';
import { Executor } from '@eve-fabric/executor';
import type { PipelineDefinition } from '@eve-fabric/compiler';
import type { SourceAdapter, SourceAdapterResult, ProvenanceRecord } from '@eve-fabric/domain';

function buildCatalog(): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  const capabilities = [
    {
      id: 'universe.resolve.type',
      version: 1,
      name: 'Resolve Type',
      description: 'Resolve EVE type by ID',
      inputs: { item: { name: 'item', semanticType: 'eve.type.reference', required: true } },
      outputs: { type: { name: 'type', semanticType: 'eve.type.info', required: true } },
      source: 'ESI' as const,
    },
    {
      id: 'universe.resolve.region',
      version: 1,
      name: 'Resolve Region',
      description: 'Resolve EVE region by ID',
      inputs: { region: { name: 'region', semanticType: 'eve.region.reference', required: true } },
      outputs: { region: { name: 'region', semanticType: 'eve.region.info', required: true } },
      source: 'ESI' as const,
    },
    {
      id: 'market.orders',
      version: 1,
      name: 'Market Orders',
      description: 'Fetch market orders for an item in a region',
      inputs: {
        item: { name: 'item', semanticType: 'eve.type.reference', required: true },
        region: { name: 'region', semanticType: 'eve.region.reference', required: true },
      },
      outputs: {
        orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
      },
      source: 'ESI' as const,
    },
    {
      id: 'market.aggregate',
      version: 1,
      name: 'Market Aggregate',
      description: 'Aggregate market orders into price summary',
      inputs: {
        orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
      },
      outputs: {
        lowestSell: { name: 'lowestSell', semanticType: 'eve.currency.isk', required: true },
        highestBuy: { name: 'highestBuy', semanticType: 'eve.currency.isk', required: true },
      },
      source: 'DERIVED' as const,
    },
    {
      id: 'collection.filter',
      version: 1,
      name: 'Filter Collection',
      description: 'Filter a collection by criteria',
      inputs: {
        items: { name: 'items', semanticType: 'eve.market.order.collection', required: true },
      },
      outputs: {
        filtered: { name: 'filtered', semanticType: 'eve.market.order.collection', required: true },
      },
      source: 'DERIVED' as const,
    },
    {
      id: 'collection.sort',
      version: 1,
      name: 'Sort Collection',
      description: 'Sort a collection',
      inputs: {
        items: { name: 'items', semanticType: 'eve.market.order.collection', required: true },
      },
      outputs: {
        sorted: { name: 'sorted', semanticType: 'eve.market.order.collection', required: true },
      },
      source: 'DERIVED' as const,
    },
  ];

  for (const cap of capabilities) {
    catalog.register({
      ...cap,
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: {
        estimatedLatencyMs: cap.source === 'ESI' ? 200 : 10,
        esiCallCount: cap.source === 'ESI' ? 1 : 0,
      },
    });
  }

  return catalog;
}

function buildPipeline(): PipelineDefinition {
  return {
    id: 'trade-opportunity',
    version: 1,
    name: 'Trade Opportunity',
    inputs: [
      { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
    ],
    nodes: [
      {
        id: 'resolve-item',
        capability: { id: capabilityId('universe.resolve.type'), version: capabilityVersion(1) },
      },
      {
        id: 'orders',
        capability: { id: capabilityId('market.orders'), version: capabilityVersion(1) },
      },
      {
        id: 'aggregate',
        capability: { id: capabilityId('market.aggregate'), version: capabilityVersion(1) },
      },
      {
        id: 'filter',
        capability: { id: capabilityId('collection.filter'), version: capabilityVersion(1) },
      },
      {
        id: 'sort',
        capability: { id: capabilityId('collection.sort'), version: capabilityVersion(1) },
      },
    ],
    edges: [
      { from: 'input.item', to: 'resolve-item.item' },
      { from: 'input.item', to: 'orders.item' },
      { from: 'input.region', to: 'orders.region' },
      { from: 'orders.orders', to: 'aggregate.orders' },
      { from: 'orders.orders', to: 'filter.items' },
      { from: 'filter.filtered', to: 'sort.items' },
    ],
    outputs: [
      { name: 'lowestSell', source: 'aggregate.lowestSell' },
      { name: 'highestBuy', source: 'aggregate.highestBuy' },
      { name: 'sorted', source: 'sort.sorted' },
    ],
  };
}

function createMockAdapter(name: string): SourceAdapter {
  return {
    name,
    supports: () => true,
    execute: async (
      _cap: unknown,
      _inputs: ReadonlyMap<string, unknown>,
    ): Promise<SourceAdapterResult> => {
      return {
        data: { mock: true },
        provenance: {
          source: name,
          capability: { id: capabilityId('mock.capability') },
          capabilityVersion: 1,
          cached: false,
          upstream: [],
        } as ProvenanceRecord,
      };
    },
  };
}

function bench(label: string, fn: () => void, iterations = 1000): number {
  // Warmup
  for (let i = 0; i < 10; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  return elapsed / iterations;
}

async function benchAsync(
  label: string,
  fn: () => Promise<void>,
  iterations = 100,
): Promise<number> {
  // Warmup
  for (let i = 0; i < 5; i++) await fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  return elapsed / iterations;
}

async function main() {
  const catalog = buildCatalog();
  const pipeline = buildPipeline();

  console.log('EVE Schema Gateway — Performance Benchmark');
  console.log('='.repeat(55));
  console.log(`Pipeline: ${pipeline.name} (${pipeline.nodes.length} nodes)`);
  console.log();

  // Compile benchmark
  const compileMs = bench('Compile', () => {
    compile(pipeline, catalog);
  });

  // Plan benchmark
  const result = compile(pipeline, catalog);
  if (!result.success || !result.plan) {
    console.error('Compilation failed:', result.diagnostics);
    process.exit(1);
  }

  const planMs = bench('Plan', () => {
    planExecution(result.plan!);
  });

  // Execute benchmark
  const executor = new Executor({
    adapters: [createMockAdapter('ESI'), createMockAdapter('DERIVED')],
    maxConcurrency: 5,
  });

  const inputs = new Map<string, unknown>([
    ['item', 34],
    ['region', 10000002],
  ]);

  const executeMs = await benchAsync('Execute', async () => {
    await executor.execute(result.plan!, inputs);
  });

  // Print results
  console.log('┌─────────────┬────────────┬────────────┐');
  console.log('│ Operation   │ Avg (ms)   │ Ops/sec    │');
  console.log('├─────────────┼────────────┼────────────┤');
  console.log(
    `│ Compile     │ ${compileMs.toFixed(3).padStart(10)} │ ${Math.floor(1000 / compileMs)
      .toString()
      .padStart(10)} │`,
  );
  console.log(
    `│ Plan        │ ${planMs.toFixed(3).padStart(10)} │ ${Math.floor(1000 / planMs)
      .toString()
      .padStart(10)} │`,
  );
  console.log(
    `│ Execute     │ ${executeMs.toFixed(3).padStart(10)} │ ${Math.floor(1000 / executeMs)
      .toString()
      .padStart(10)} │`,
  );
  console.log('└─────────────┴────────────┴────────────┘');
  console.log();
  console.log(
    `Total pipeline (compile+plan+execute): ${(compileMs + planMs + executeMs).toFixed(3)}ms`,
  );
}

main().catch(console.error);
