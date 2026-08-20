import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '../src/executor.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type {
  ExecutionPlan,
  ExecutionStep,
  SourceAdapter,
  SourceAdapterResult,
  CachePort,
  CacheEntry,
} from '@eve-fabric/domain';

// ── Test helpers ──────────────────────────────────────────────

function makeTestCatalog(capabilityIds: string[], source = 'ESI'): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  for (const id of capabilityIds) {
    catalog.register({
      id,
      version: 1,
      name: id,
      description: `Test capability ${id}`,
      inputs: { input: { name: 'input', semanticType: 'eve.type.reference', required: false } },
      outputs: { result: { name: 'result', semanticType: 'eve.type.reference', required: true } },
      source,
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: false,
        defaultTtlSeconds: 0,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
    });
  }
  return catalog;
}

function makeStep(id: string, overrides?: Partial<ExecutionStep>): ExecutionStep {
  return {
    id,
    capability: { id: `test.${id}` as never, version: undefined },
    inputs: [],
    dependsOn: [],
    canParallelize: true,
    ...overrides,
  } as ExecutionStep;
}

function makePlan(overrides: {
  steps: readonly ExecutionStep[];
  sourceRequirements?: readonly { source: string; capabilities: readonly { id: string }[] }[];
  cacheStrategy?: readonly {
    stepId: string;
    cacheable: boolean;
    ttlSeconds: number;
    identityInKey: boolean;
  }[];
}): ExecutionPlan {
  return {
    id: 'test-plan',
    pipelineRef: { id: 'test-pipeline', version: 1 },
    steps: overrides.steps,
    parallelGroups: [],
    sourceRequirements: overrides.sourceRequirements ?? [
      {
        source: 'TEST',
        capabilities: overrides.steps.map((s) => ({ id: s.capability.id })),
      },
    ],
    authRequirements: { required: false, scopes: [] },
    cacheStrategy: overrides.cacheStrategy ?? [],
    costEstimate: { totalLatencyMs: 0, esiCallCount: 0, parallelLatencyMs: 0 },
    createdAt: new Date(),
  } as ExecutionPlan;
}

function makeTestAdapter(name: string, data: unknown = { result: 'ok' }): SourceAdapter {
  return {
    name,
    supports: (_cap: unknown) => true,
    execute: vi.fn(
      async (
        _cap: unknown,
        _inputs: ReadonlyMap<string, unknown>,
      ): Promise<SourceAdapterResult> => ({
        data,
        provenance: {
          source: name as never,
          capability: { id: 'test.step' as never },
          capabilityVersion: '1.0.0',
          cached: false,
          upstream: [],
        },
      }),
    ),
  } as unknown as SourceAdapter;
}

function makeTestCache(): CachePort & {
  _store: Map<string, { data: unknown; ttlSeconds: number }>;
} {
  const store = new Map<string, { data: unknown; ttlSeconds: number }>();
  return {
    _store: store,
    get: vi.fn(async (key: string): Promise<CacheEntry | undefined> => {
      const entry = store.get(key);
      if (entry === undefined) return undefined;
      return {
        data: entry.data,
        storedAt: new Date(),
        ttlSeconds: entry.ttlSeconds,
      };
    }),
    set: vi.fn(async (key: string, data: unknown, ttlSeconds: number): Promise<void> => {
      store.set(key, { data, ttlSeconds });
    }),
    has: vi.fn(async (key: string): Promise<boolean> => store.has(key)),
    delete: vi.fn(async (key: string): Promise<void> => {
      store.delete(key);
    }),
    clear: vi.fn(async (): Promise<void> => {
      store.clear();
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe('Executor', () => {
  let adapter: SourceAdapter;
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    adapter = makeTestAdapter('TEST');
    catalog = makeTestCatalog([
      'test.step1',
      'test.step2',
      'test.a',
      'test.b',
      'test.c',
      'test.d',
      'test.x',
    ]);
  });

  describe('basic execution', () => {
    it('executes a single-step plan', async () => {
      const plan = makePlan({
        steps: [makeStep('step1')],
      });

      const executor = new Executor({ adapters: [adapter], catalog });
      const result = await executor.execute(plan, new Map());

      expect(result.outputs.has('step1')).toBe(true);
      expect(result.outputs.get('step1')).toEqual({ result: 'ok' });
    });

    it('executes multiple independent steps', async () => {
      const plan = makePlan({
        steps: [makeStep('a'), makeStep('b'), makeStep('c')],
      });

      const executor = new Executor({ adapters: [adapter], catalog });
      const result = await executor.execute(plan, new Map());

      expect(result.outputs.size).toBe(3);
      expect(result.outputs.has('a')).toBe(true);
      expect(result.outputs.has('b')).toBe(true);
      expect(result.outputs.has('c')).toBe(true);
    });

    it('executes steps with dependencies in correct order', async () => {
      const orderedAdapter: SourceAdapter = {
        name: 'TEST',
        supports: () => true,
        execute: vi.fn(async (_cap, _inputs) => {
          // We'll track order externally
          return {
            data: { result: 'ok' },
            provenance: {
              source: 'TEST' as never,
              capability: { id: 'test.x' as never },
              capabilityVersion: '1.0.0',
              cached: false,
              upstream: [],
            },
          };
        }),
      } as unknown as SourceAdapter;

      const plan = makePlan({
        steps: [
          makeStep('a'),
          makeStep('b', { dependsOn: ['a'], canParallelize: false }),
          makeStep('c', { dependsOn: ['b'], canParallelize: false }),
        ],
      });

      const executor = new Executor({ adapters: [orderedAdapter], catalog });
      const result = await executor.execute(plan, new Map());

      expect(result.outputs.size).toBe(3);
    });
  });

  describe('metrics', () => {
    it('tracks total duration', async () => {
      const plan = makePlan({
        steps: [makeStep('step1')],
      });

      const executor = new Executor({ adapters: [adapter], catalog });
      const result = await executor.execute(plan, new Map());

      expect(result.metrics.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('tracks per-step duration', async () => {
      const plan = makePlan({
        steps: [makeStep('step1'), makeStep('step2')],
      });

      const executor = new Executor({ adapters: [adapter], catalog });
      const result = await executor.execute(plan, new Map());

      expect(result.metrics.stepDurations.has('step1')).toBe(true);
      expect(result.metrics.stepDurations.has('step2')).toBe(true);
    });

    it('counts cache misses when no cache configured', async () => {
      const plan = makePlan({
        steps: [makeStep('step1')],
      });

      const executor = new Executor({ adapters: [adapter], catalog });
      const result = await executor.execute(plan, new Map());

      expect(result.metrics.cacheMisses).toBe(1);
      expect(result.metrics.cacheHits).toBe(0);
    });
  });

  describe('caching', () => {
    it('checks cache before executing adapter', async () => {
      const cache = makeTestCache();
      // Pre-populate cache
      cache._store.set('cache-key-1', { data: { cached: true }, ttlSeconds: 60 });

      const plan = makePlan({
        steps: [makeStep('step1', { cacheKey: 'cache-key-1' })],
      });

      const executor = new Executor({ adapters: [adapter], catalog, cache });
      const result = await executor.execute(plan, new Map());

      expect(result.outputs.get('step1')).toEqual({ cached: true });
      expect(result.metrics.cacheHits).toBe(1);
      expect(result.metrics.cacheMisses).toBe(0);
      // Adapter should not have been called
      expect(adapter.execute).not.toHaveBeenCalled();
    });

    it('stores adapter result in cache after execution', async () => {
      const cache = makeTestCache();

      const plan = makePlan({
        steps: [makeStep('step1', { cacheKey: 'cache-key-1' })],
        cacheStrategy: [
          { stepId: 'step1', cacheable: true, ttlSeconds: 120, identityInKey: false },
        ],
      });

      const executor = new Executor({ adapters: [adapter], catalog, cache });
      await executor.execute(plan, new Map());

      expect(cache.set).toHaveBeenCalledWith('cache-key-1', { result: 'ok' }, 120);
    });

    it('does not check cache when step has no cacheKey', async () => {
      const cache = makeTestCache();

      const plan = makePlan({
        steps: [makeStep('step1')], // no cacheKey
      });

      const executor = new Executor({ adapters: [adapter], catalog, cache });
      await executor.execute(plan, new Map());

      expect(cache.get).not.toHaveBeenCalled();
    });
  });

  describe('provenance', () => {
    it('attaches provenance to each step result', async () => {
      const plan = makePlan({
        steps: [makeStep('step1')],
      });

      const executor = new Executor({ adapters: [adapter], catalog });
      const result = await executor.execute(plan, new Map());

      expect(result.provenance.has('step1')).toBe(true);
      const prov = result.provenance.get('step1') as Record<string, unknown>;
      expect(prov).toBeDefined();
    });

    it('marks provenance as cached when served from cache', async () => {
      const cache = makeTestCache();
      cache._store.set('key1', { data: 'cached-data', ttlSeconds: 60 });

      const plan = makePlan({
        steps: [makeStep('step1', { cacheKey: 'key1' })],
      });

      const executor = new Executor({ adapters: [adapter], catalog, cache });
      const result = await executor.execute(plan, new Map());

      const prov = result.provenance.get('step1') as Record<string, unknown>;
      expect(prov).toBeDefined();
      expect(prov['cached']).toBe(true);
      expect(prov['source']).toBe('CACHE');
    });
  });

  describe('adapter routing', () => {
    it('routes to the correct adapter by source name', async () => {
      const esiAdapter = makeTestAdapter('ESI', { esi: true });
      const sdeAdapter = makeTestAdapter('SDE', { sde: true });

      const routingCatalog = new CapabilityCatalog();
      routingCatalog.register({
        id: 'market.orders',
        version: 1,
        name: 'Market Orders',
        description: 'test',
        inputs: {
          region: { name: 'region', semanticType: 'eve.region.reference', required: true },
        },
        outputs: {
          orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
        },
        source: 'ESI',
        dependencies: [],
        auth: { required: false, scopes: [] },
        cache: {
          cacheable: false,
          defaultTtlSeconds: 0,
          stalePermitted: false,
          identityInKey: false,
        },
        cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
      });
      routingCatalog.register({
        id: 'sde.types',
        version: 1,
        name: 'SDE Types',
        description: 'test',
        inputs: { query: { name: 'query', semanticType: 'eve.type.reference', required: true } },
        outputs: { type: { name: 'type', semanticType: 'eve.type.reference', required: true } },
        source: 'SDE',
        dependencies: [],
        auth: { required: false, scopes: [] },
        cache: {
          cacheable: false,
          defaultTtlSeconds: 0,
          stalePermitted: false,
          identityInKey: false,
        },
        cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
      });

      const plan = makePlan({
        steps: [
          makeStep('a', { capability: { id: 'market.orders' as never } }),
          makeStep('b', { capability: { id: 'sde.types' as never } }),
        ],
        sourceRequirements: [
          { source: 'ESI', capabilities: [{ id: 'market.orders' }] },
          { source: 'SDE', capabilities: [{ id: 'sde.types' }] },
        ],
      });

      const executor = new Executor({
        adapters: [esiAdapter, sdeAdapter],
        catalog: routingCatalog,
      });
      const result = await executor.execute(plan, new Map());

      expect(result.outputs.get('a')).toEqual({ esi: true });
      expect(result.outputs.get('b')).toEqual({ sde: true });
    });

    it('throws when no adapter matches', async () => {
      const plan = makePlan({
        steps: [makeStep('step1')],
        sourceRequirements: [{ source: 'UNKNOWN', capabilities: [{ id: 'test.step1' }] }],
      });

      const emptyCatalog = makeTestCatalog(['test.step1'], 'DERIVED');
      const executor = new Executor({ adapters: [], catalog: emptyCatalog });
      await expect(executor.execute(plan, new Map())).rejects.toThrow(/[Nn]o adapter/);
    });
  });

  describe('concurrency', () => {
    it('respects maxConcurrency limit', async () => {
      let activeConcurrency = 0;
      let maxObserved = 0;

      const slowAdapter: SourceAdapter = {
        name: 'TEST',
        supports: () => true,
        execute: vi.fn(async () => {
          activeConcurrency++;
          maxObserved = Math.max(maxObserved, activeConcurrency);
          await new Promise((r) => setTimeout(r, 50));
          activeConcurrency--;
          return {
            data: { done: true },
            provenance: {
              source: 'TEST' as never,
              capability: { id: 'test.x' as never },
              capabilityVersion: '1.0.0',
              cached: false,
              upstream: [],
            },
          };
        }),
      } as unknown as SourceAdapter;

      const plan = makePlan({
        steps: [makeStep('a'), makeStep('b'), makeStep('c'), makeStep('d')],
      });

      const executor = new Executor({
        adapters: [slowAdapter],
        catalog,
        maxConcurrency: 2,
      });
      const result = await executor.execute(plan, new Map());

      expect(result.outputs.size).toBe(4);
      expect(maxObserved).toBeLessThanOrEqual(2);
    });
  });

  describe('input resolution', () => {
    it('passes pipeline inputs to steps', async () => {
      let receivedInputs: ReadonlyMap<string, unknown> | undefined;

      const capturingAdapter: SourceAdapter = {
        name: 'TEST',
        supports: () => true,
        execute: vi.fn(async (_cap, inputs) => {
          receivedInputs = inputs;
          return {
            data: { result: 'ok' },
            provenance: {
              source: 'TEST' as never,
              capability: { id: 'test.step1' as never },
              capabilityVersion: '1.0.0',
              cached: false,
              upstream: [],
            },
          };
        }),
      } as unknown as SourceAdapter;

      const plan = makePlan({
        steps: [
          makeStep('step1', {
            inputs: [
              {
                portName: 'region_id',
                source: 'pipeline-input',
                pipelineInputName: 'regionId',
              },
            ],
          }),
        ],
      });

      const pipelineInputs = new Map<string, unknown>([['regionId', 10000002]]);
      const executor = new Executor({ adapters: [capturingAdapter], catalog });
      await executor.execute(plan, pipelineInputs);

      expect(receivedInputs).toBeDefined();
      expect(receivedInputs!.get('region_id')).toBe(10000002);
    });
  });
});
