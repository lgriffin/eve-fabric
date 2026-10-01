import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  CapabilityCatalog,
  SemanticTypeRegistry,
  createSemanticType,
  capabilityId,
  capabilityVersion,
  fixedClock,
  semanticTypeId,
} from '@eve-fabric/core';
import type {
  CacheEntry,
  CachePort,
  CapabilityDefinition,
  ExecutionPlan,
  PipelineDefinition,
  SourcePorts,
} from '@eve-fabric/core';
import { defineCapability } from '@eve-fabric/kit';
import { compile } from '@eve-fabric/compiler';
import {
  Executor,
  PortValueError,
  SourceUnavailableError,
  StepExecutionError,
} from '../src/index.js';

// ── Capabilities ──────────────────────────────────────────────

const double = defineCapability({
  id: 'test.double',
  version: '1.0.0',
  name: 'Double',
  description: 'Doubles a number',
  inputs: { value: { type: 'eve.quantity' } },
  outputs: { doubled: { type: 'eve.quantity' }, original: { type: 'eve.quantity' } },
  run: ({ value }) => ({ doubled: Number(value) * 2, original: value }),
});

const increment = defineCapability({
  id: 'test.increment',
  version: '1.0.0',
  name: 'Increment',
  description: 'Adds one',
  inputs: { value: { type: 'eve.quantity' } },
  outputs: { result: { type: 'eve.quantity' } },
  cache: { cacheable: true, defaultTtlSeconds: 60 },
  run: ({ value }) => ({ result: Number(value) + 1 }),
});

const typeName = defineCapability({
  id: 'test.type.name',
  version: '1.0.0',
  name: 'Type Name',
  description: 'Looks a type up in the SDE',
  inputs: { typeId: { type: 'eve.type.reference' } },
  outputs: { name: { type: 'eve.quantity' } },
  uses: ['sde'],
  run: ({ typeId }, { sde }) => ({ name: sde.getType(Number(typeId))?.name ?? null }),
});

const regionOrders = defineCapability({
  id: 'test.region.orders',
  version: '1.0.0',
  name: 'Region Orders',
  description: 'Reaches the public ESI view',
  inputs: { region: { type: 'eve.region.reference' } },
  outputs: { orders: { type: 'eve.market.order.collection' } },
  uses: ['esi.public'],
  run: ({ region }, { esi }) => ({ orders: [{ esi: typeof esi, region }] }),
});

function catalogWith(...defs: CapabilityDefinition[]): CapabilityCatalog {
  const catalog = new CapabilityCatalog({ executable: true });
  for (const def of defs) catalog.register(def);
  return catalog;
}

function node(id: string, cap: CapabilityDefinition) {
  return { id, capability: { id: cap.id, version: cap.version } };
}

function planFor(pipeline: PipelineDefinition, catalog: CapabilityCatalog): ExecutionPlan {
  const result = compile(pipeline, catalog, { clock: fixedClock(0) });
  if (!result.success || result.plan === undefined) {
    throw new Error(JSON.stringify(result.diagnostics));
  }
  return result.plan as unknown as ExecutionPlan;
}

function single(
  cap: CapabilityDefinition,
  inputName: string,
  inputType: string,
): PipelineDefinition {
  const port = [...cap.inputs.keys()][0]!;
  return {
    id: `single-${cap.id as string}`,
    version: 1,
    name: 'single',
    inputs: [{ name: inputName, semanticType: semanticTypeId(inputType), required: true }],
    nodes: [node('step', cap)],
    edges: [{ from: `input.${inputName}`, to: `step.${port}` }],
    outputs: [...cap.outputs.keys()].map((name) => ({ name, source: `step.${name}` })),
  };
}

const chain: PipelineDefinition = {
  id: 'chain',
  version: 1,
  name: 'Chain',
  inputs: [{ name: 'n', semanticType: semanticTypeId('eve.quantity'), required: true }],
  nodes: [node('first', double), node('second', increment)],
  edges: [
    { from: 'input.n', to: 'first.value' },
    { from: 'first.doubled', to: 'second.value' },
  ],
  outputs: [{ name: 'result', source: 'second.result' }],
};

function memoryCache(): CachePort & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string): Promise<CacheEntry | undefined> =>
      store.has(key) ? { data: store.get(key), storedAt: new Date(0), ttlSeconds: 60 } : undefined,
    ),
    set: vi.fn(async (key: string, data: unknown) => {
      store.set(key, data);
    }),
    has: vi.fn(async (key: string) => store.has(key)),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe('Executor', () => {
  describe('running capabilities', () => {
    it('runs each capability and keys its outputs by step then port', async () => {
      const catalog = catalogWith(double);
      const executor = new Executor({ catalog });
      const result = await executor.execute(
        planFor(single(double, 'n', 'eve.quantity'), catalog),
        new Map([['n', 21]]),
      );
      expect(result.outputs.get('step')).toEqual({ doubled: 42, original: 21 });
    });

    it('feeds a step the upstream port its binding names, not the whole output', async () => {
      const catalog = catalogWith(double, increment);
      const executor = new Executor({ catalog });
      const result = await executor.execute(planFor(chain, catalog), new Map([['n', 5]]));
      expect(result.outputs.get('second')).toEqual({ result: 11 });
    });

    it('runs independent steps and respects maxConcurrency', async () => {
      let running = 0;
      let peak = 0;
      const slow = defineCapability({
        id: 'test.slow',
        version: '1.0.0',
        name: 'Slow',
        description: 'Waits a tick',
        inputs: { value: { type: 'eve.quantity' } },
        outputs: { value: { type: 'eve.quantity' } },
        async run({ value }) {
          running++;
          peak = Math.max(peak, running);
          await new Promise((r) => setTimeout(r, 5));
          running--;
          return { value };
        },
      });
      const catalog = catalogWith(slow);
      const pipeline: PipelineDefinition = {
        id: 'fan',
        version: 1,
        name: 'Fan',
        inputs: ['a', 'b', 'c', 'd'].map((id) => ({
          name: id,
          semanticType: semanticTypeId('eve.quantity'),
          required: true,
        })),
        nodes: ['a', 'b', 'c', 'd'].map((id) => node(id, slow)),
        edges: ['a', 'b', 'c', 'd'].map((id) => ({ from: `input.${id}`, to: `${id}.value` })),
        outputs: ['a', 'b', 'c', 'd'].map((id) => ({ name: id, source: `${id}.value` })),
      };
      const executor = new Executor({ catalog, maxConcurrency: 2 });
      const inputs = new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4],
      ]);
      const result = await executor.execute(planFor(pipeline, catalog), inputs);
      expect(result.outputs.size).toBe(4);
      expect(peak).toBe(2);
    });

    it('runs identical steps once and gives each step id the shared result', async () => {
      const run = vi.fn(({ value }: { readonly value: unknown }) => ({ value }));
      const echo = defineCapability({
        id: 'test.echo',
        version: '1.0.0',
        name: 'Echo',
        description: 'Echoes',
        inputs: { value: { type: 'eve.quantity' } },
        outputs: { value: { type: 'eve.quantity' } },
        run,
      });
      const catalog = catalogWith(echo);
      const pipeline: PipelineDefinition = {
        id: 'twins',
        version: 1,
        name: 'Twins',
        inputs: [{ name: 'n', semanticType: semanticTypeId('eve.quantity'), required: true }],
        nodes: [node('a', echo), node('b', echo)],
        edges: [
          { from: 'input.n', to: 'a.value' },
          { from: 'input.n', to: 'b.value' },
        ],
        outputs: [
          { name: 'a', source: 'a.value' },
          { name: 'b', source: 'b.value' },
        ],
      };
      const result = await new Executor({ catalog }).execute(
        planFor(pipeline, catalog),
        new Map([['n', 9]]),
      );
      expect(run).toHaveBeenCalledTimes(1);
      expect(result.outputs.get('a')).toEqual({ value: 9 });
      expect(result.outputs.get('b')).toEqual({ value: 9 });
      expect(result.provenance.has('b')).toBe(true);
    });

    it("feeds a step reading a merged step the kept step's result", async () => {
      const catalog = catalogWith(double, increment);
      const pipeline: PipelineDefinition = {
        id: 'merged-upstream',
        version: 1,
        name: 'Merged upstream',
        inputs: [{ name: 'n', semanticType: semanticTypeId('eve.quantity'), required: true }],
        nodes: [node('a', double), node('b', double), node('next', increment)],
        edges: [
          { from: 'input.n', to: 'a.value' },
          { from: 'input.n', to: 'b.value' },
          { from: 'b.doubled', to: 'next.value' },
        ],
        outputs: [
          { name: 'a', source: 'a.doubled' },
          { name: 'next', source: 'next.result' },
        ],
      };
      const result = await new Executor({ catalog }).execute(
        planFor(pipeline, catalog),
        new Map([['n', 3]]),
      );
      expect(result.outputs.get('next')).toEqual({ result: 7 });
    });

    it('measures with the injected clock', async () => {
      const catalog = catalogWith(double);
      const executor = new Executor({ catalog, clock: fixedClock(1000) });
      const result = await executor.execute(
        planFor(single(double, 'n', 'eve.quantity'), catalog),
        new Map([['n', 1]]),
      );
      expect(result.metrics.totalDurationMs).toBe(0);
      expect(result.metrics.stepDurations.get('step')).toBe(0);
    });
  });

  describe('failures', () => {
    it('names the step and capability when a run throws', async () => {
      const broken = defineCapability({
        id: 'test.broken',
        version: '1.0.0',
        name: 'Broken',
        description: 'Throws',
        inputs: { value: { type: 'eve.quantity' } },
        outputs: { value: { type: 'eve.quantity' } },
        run: () => {
          throw new Error('boom');
        },
      });
      const catalog = catalogWith(broken);
      const executor = new Executor({ catalog });
      const run = executor.execute(
        planFor(single(broken, 'n', 'eve.quantity'), catalog),
        new Map([['n', 1]]),
      );
      await expect(run).rejects.toBeInstanceOf(StepExecutionError);
      await expect(run).rejects.toThrow('Step "step" (test.broken) failed: boom');
    });

    it('rejects a run that does not return an object of port values', async () => {
      const bad = defineCapability({
        id: 'test.bad',
        version: '1.0.0',
        name: 'Bad',
        description: 'Returns a bare value',
        inputs: { value: { type: 'eve.quantity' } },
        outputs: { value: { type: 'eve.quantity' } },
        run: () => 7 as never,
      });
      const catalog = catalogWith(bad);
      const executor = new Executor({ catalog });
      await expect(
        executor.execute(planFor(single(bad, 'n', 'eve.quantity'), catalog), new Map([['n', 1]])),
      ).rejects.toThrow('run must return an object of output port values');
    });

    it('refuses a capability without a run (FAB-VAL-01)', async () => {
      const contractOnly = new CapabilityCatalog();
      contractOnly.register({ ...double, run: undefined });
      const plan = planFor(single(double, 'n', 'eve.quantity'), contractOnly);
      const executor = new Executor({ catalog: contractOnly });
      await expect(executor.execute(plan, new Map([['n', 1]]))).rejects.toThrow(
        'has no run function (FAB-VAL-01)',
      );
    });

    it('fails a capability whose source the executor was not given', async () => {
      const catalog = catalogWith(typeName);
      const executor = new Executor({ catalog });
      await expect(
        executor.execute(
          planFor(single(typeName, 't', 'eve.type.reference'), catalog),
          new Map([['t', 34]]),
        ),
      ).rejects.toBeInstanceOf(SourceUnavailableError);
    });

    describe('a scoped ESI capability', () => {
      const scope = 'esi-wallet.read_character_wallet.v1';
      const seen: unknown[] = [];
      const wallet = defineCapability({
        id: 'test.wallet.view',
        version: '1.0.0',
        name: 'Wallet',
        description: 'Needs a scope',
        inputs: { character: { type: 'eve.character.reference' } },
        outputs: { balance: { type: 'eve.currency.isk' } },
        uses: [`esi:${scope}`],
        cache: { cacheable: true, defaultTtlSeconds: 60 },
        run: (_inputs, { esi }) => {
          seen.push(esi);
          return { balance: 0 };
        },
      });
      const run = (caller?: { key: string; scopes: string[]; credentials: unknown }) => {
        const catalog = catalogWith(wallet);
        const executor = new Executor({
          catalog,
          sources: {
            esi: { public: {}, compatibilityDate: '2026-08-18', as: (c) => ({ viewOf: c }) },
          },
        });
        return executor.execute(
          planFor(single(wallet, 'c', 'eve.character.reference'), catalog),
          new Map([['c', 1]]),
          { caller },
        );
      };

      it('fails without a caller, naming the scope', async () => {
        await expect(run()).rejects.toThrow(scope);
        await expect(run()).rejects.toThrow(/run it as an identity/);
      });

      it('fails for a caller whose token lacks the scope', async () => {
        await expect(run({ key: 'character:1', scopes: [], credentials: 'a' })).rejects.toThrow(
          /does not hold/,
        );
      });

      it("runs on the caller's own view", async () => {
        seen.length = 0;
        await run({ key: 'character:1', scopes: [scope], credentials: 'token-a' });
        expect(seen).toEqual([{ viewOf: 'token-a' }]);
      });
    });
  });

  describe('sources and provenance', () => {
    const sources: SourcePorts = {
      esi: {
        public: { marker: 'public view' },
        compatibilityDate: '2026-08-18',
        as: (identity: unknown) => ({ viewOf: identity }),
      },
      sde: {
        provider: { getType: (id: number) => (id === 34 ? { name: 'Tritanium' } : undefined) },
        buildVersion: () => '3142455',
      },
    };

    it('hands an SDE capability the provider and records the SDE build', async () => {
      const catalog = catalogWith(typeName);
      const executor = new Executor({ catalog, sources, clock: fixedClock(0) });
      const result = await executor.execute(
        planFor(single(typeName, 't', 'eve.type.reference'), catalog),
        new Map([['t', 34]]),
      );
      expect(result.outputs.get('step')).toEqual({ name: 'Tritanium' });
      const prov = result.provenance.get('step')!;
      expect(prov.source).toBe('SDE');
      expect(prov.sourceVersion).toBe('sde:3142455');
      expect(prov.retrievedAt).toEqual(new Date(0));
    });

    it('hands an ESI capability the public view and records the compatibility date', async () => {
      const catalog = catalogWith(regionOrders);
      const executor = new Executor({ catalog, sources });
      const result = await executor.execute(
        planFor(single(regionOrders, 'r', 'eve.region.reference'), catalog),
        new Map([['r', 10000002]]),
      );
      expect(result.outputs.get('step')).toEqual({
        orders: [{ esi: 'object', region: 10000002 }],
      });
      expect(result.provenance.get('step')!.sourceVersion).toBe('esi-compat:2026-08-18');
    });

    it('records a derived step as calculated', async () => {
      const catalog = catalogWith(double);
      const executor = new Executor({ catalog, clock: fixedClock(5) });
      const result = await executor.execute(
        planFor(single(double, 'n', 'eve.quantity'), catalog),
        new Map([['n', 1]]),
      );
      const prov = result.provenance.get('step')!;
      expect(prov.source).toBe('DERIVED');
      expect(prov.calculatedAt).toEqual(new Date(5));
      expect(prov.sourceVersion).toBeUndefined();
    });
  });

  describe('caching', () => {
    it('caches a cacheable step by capability, version and inputs, and serves the repeat', async () => {
      const catalog = catalogWith(increment);
      const cache = memoryCache();
      const executor = new Executor({ catalog, cache });
      const plan = planFor(single(increment, 'n', 'eve.quantity'), catalog);

      const first = await executor.execute(plan, new Map([['n', 1]]));
      expect(first.metrics.cacheMisses).toBe(1);
      expect([...cache.store.keys()]).toEqual(['test.increment@1.0.0:{"value":1}']);

      const second = await executor.execute(plan, new Map([['n', 1]]));
      expect(second.metrics.cacheHits).toBe(1);
      expect(second.outputs.get('step')).toEqual({ result: 2 });
      expect(second.provenance.get('step')!.cached).toBe(true);
    });

    it('does not store a result whose TTL is zero', async () => {
      const noTtl = defineCapability({
        id: 'test.no.ttl',
        version: '1.0.0',
        name: 'No TTL',
        description: 'Cacheable, but for no time at all',
        inputs: { value: { type: 'eve.quantity' } },
        outputs: { result: { type: 'eve.quantity' } },
        cache: { cacheable: true, defaultTtlSeconds: 0 },
        run: ({ value }) => ({ result: value }),
      });
      const catalog = catalogWith(noTtl);
      const cache = memoryCache();
      await new Executor({ catalog, cache }).execute(
        planFor(single(noTtl, 'n', 'eve.quantity'), catalog),
        new Map([['n', 1]]),
      );
      expect(cache.store.size).toBe(0);
    });

    it('keys an SDE step by its build, and a hit still names that build', async () => {
      const cachedName = defineCapability({
        id: 'test.type.name.cached',
        version: '1.0.0',
        name: 'Type Name',
        description: 'Looks a type up in the SDE, cached',
        inputs: { typeId: { type: 'eve.type.reference' } },
        outputs: { name: { type: 'eve.quantity' } },
        uses: ['sde'],
        cache: { defaultTtlSeconds: 60 },
        run: ({ typeId }, { sde }) => ({ name: sde.getType(Number(typeId))?.name ?? null }),
      });
      let build = 'one';
      const sources: SourcePorts = {
        sde: { provider: { getType: () => ({ name: 'Tritanium' }) }, buildVersion: () => build },
      };
      const catalog = catalogWith(cachedName);
      const cache = memoryCache();
      const executor = new Executor({ catalog, cache, sources });
      const plan = planFor(single(cachedName, 't', 'eve.type.reference'), catalog);

      await executor.execute(plan, new Map([['t', 34]]));
      const hit = await executor.execute(plan, new Map([['t', 34]]));
      expect(hit.metrics.cacheHits).toBe(1);
      expect(hit.provenance.get('step')).toMatchObject({ cached: true, sourceVersion: 'sde:one' });

      build = 'two';
      const afterNewExport = await executor.execute(plan, new Map([['t', 34]]));
      expect(afterNewExport.metrics.cacheHits).toBe(0);
      expect([...cache.store.keys()]).toEqual([
        'test.type.name.cached@1.0.0[sde:one]:{"typeId":34}',
        'test.type.name.cached@1.0.0[sde:two]:{"typeId":34}',
      ]);
    });

    it('never caches an ESI step; ESI.ts caches those itself', async () => {
      const cachedEsi = defineCapability({
        id: 'test.esi.cached',
        version: '1.0.0',
        name: 'ESI',
        description: 'ESI with a cache policy',
        inputs: { region: { type: 'eve.region.reference' } },
        outputs: { orders: { type: 'eve.market.order.collection' } },
        uses: ['esi.public'],
        cache: { cacheable: true, defaultTtlSeconds: 300 },
        run: () => ({ orders: [] }),
      });
      const catalog = catalogWith(cachedEsi);
      const cache = memoryCache();
      const executor = new Executor({
        catalog,
        cache,
        sources: { esi: { public: {}, compatibilityDate: '2026-08-18', as: () => ({}) } },
      });
      await executor.execute(
        planFor(single(cachedEsi, 'r', 'eve.region.reference'), catalog),
        new Map([['r', 1]]),
      );
      expect(cache.set).not.toHaveBeenCalled();
    });

    it("keys a step that sees one caller's data by the caller", async () => {
      const mine: CapabilityDefinition = {
        ...double,
        cache: { ...double.cache, cacheable: true, defaultTtlSeconds: 60, identityInKey: true },
      };
      const catalog = catalogWith(mine);
      const cache = memoryCache();
      const executor = new Executor({ catalog, cache });
      const plan = planFor(single(mine, 'v', 'eve.quantity'), catalog);
      const as = (key: string) => ({ caller: { key, scopes: [], credentials: key } });
      await executor.execute(plan, new Map([['v', 2]]), as('character:1'));
      await executor.execute(plan, new Map([['v', 2]]), as('character:2'));
      const keys = [...cache.store.keys()];
      expect(keys).toHaveLength(2);
      expect(keys[0]).toContain('{character:1}');
      expect(keys[1]).toContain('{character:2}');
      // Without a caller there is no one to key it by, so nothing is kept.
      await executor.execute(plan, new Map([['v', 2]]));
      expect(cache.store.size).toBe(2);
    });

    it('does not cache a step whose policy says not to', async () => {
      const catalog = catalogWith(double);
      const cache = memoryCache();
      const executor = new Executor({ catalog, cache });
      await executor.execute(
        planFor(single(double, 'n', 'eve.quantity'), catalog),
        new Map([['n', 1]]),
      );
      expect(cache.get).not.toHaveBeenCalled();
    });
  });

  it('accepts plan capability refs pinned by version', () => {
    const catalog = catalogWith(double);
    expect(catalog.get(capabilityId('test.double'), capabilityVersion('1.0.0')).run).toBeTypeOf(
      'function',
    );
  });
});

describe('port values against their types', () => {
  const half = defineCapability({
    id: 'test.half',
    version: '1.0.0',
    name: 'Half',
    description: 'Halves a quantity, which may not stay whole',
    inputs: { value: { type: 'eve.quantity' } },
    outputs: { result: { type: 'eve.quantity' } },
    run: ({ value }) => ({ result: value === 0 ? null : Number(value) / 2 }),
  });

  function typedCatalog(...defs: CapabilityDefinition[]): CapabilityCatalog {
    const types = new SemanticTypeRegistry();
    types.register(
      createSemanticType({
        id: 'eve.quantity',
        description: 'A count',
        schema: z.number().int().nonnegative(),
        category: 'common',
      }),
    );
    const catalog = new CapabilityCatalog({ executable: true, types });
    for (const def of defs) catalog.register(def);
    return catalog;
  }

  it('refuses an output that is not a value of its type', async () => {
    const catalog = typedCatalog(half);
    const executor = new Executor({ catalog });
    const plan = planFor(single(half, 'n', 'eve.quantity'), catalog);
    const failure = await executor.execute(plan, new Map([['n', 3]])).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(StepExecutionError);
    expect((failure as Error).cause).toBeInstanceOf(PortValueError);
    expect((failure as Error).message).toContain('Output "result" is not a eve.quantity');
    expect((failure as PortValueError & { cause: PortValueError }).cause).toMatchObject({
      direction: 'output',
      port: 'result',
      typeId: 'eve.quantity',
    });
  });

  it('passes values of the type, and absent ones', async () => {
    const catalog = typedCatalog(half);
    const executor = new Executor({ catalog });
    const plan = planFor(single(half, 'n', 'eve.quantity'), catalog);
    expect((await executor.execute(plan, new Map([['n', 4]]))).outputs.get('step')).toEqual({
      result: 2,
    });
    expect((await executor.execute(plan, new Map([['n', 0]]))).outputs.get('step')).toEqual({
      result: null,
    });
  });

  it('refuses an input that is not a value of its type', async () => {
    const catalog = typedCatalog(half);
    const plan = planFor(single(half, 'n', 'eve.quantity'), catalog);
    await expect(new Executor({ catalog }).execute(plan, new Map([['n', -1]]))).rejects.toThrow(
      'Input "value" is not a eve.quantity',
    );
  });
});
