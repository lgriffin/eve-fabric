import { describe, it, expect } from 'vitest';
import { CapabilityCatalog } from '@eve-fabric/domain';
import {
  defineCapability,
  defineContract,
  definePack,
  parseCapabilityManifest,
  parseCapabilityManifests,
} from '../src/index.js';

const pure = defineCapability({
  id: 'test.pure',
  version: 1,
  name: 'Pure',
  description: 'Adds one',
  inputs: { value: { type: 'eve.quantity', description: 'A number' } },
  outputs: { result: { type: 'eve.quantity' } },
  run: ({ value }) => ({ result: Number(value) + 1 }),
});

describe('defineCapability', () => {
  it('keeps the contract and the run in one definition', async () => {
    expect(pure.id).toBe('test.pure');
    expect(pure.version as string).toBe('1.0.0');
    expect(pure.inputs.get('value')?.required).toBe(true);
    expect(pure.outputs.get('result')).toBeDefined();
    expect(await pure.run!({ value: 1 }, { clock: { now: () => 0 } })).toEqual({ result: 2 });
  });

  it('infers a derived source with no uses, and no ESI calls or cache', () => {
    expect(pure.source).toBe('DERIVED');
    expect(pure.uses).toEqual([]);
    expect(pure.auth).toEqual({ required: false, scopes: [] });
    expect(pure.cache.cacheable).toBe(false);
    expect(pure.cost.esiCallCount).toBe(0);
  });

  it('infers ESI from esi.public, with one ESI call and no scopes', () => {
    const cap = defineCapability({
      id: 'test.esi',
      version: '2.0.0',
      name: 'ESI',
      description: '',
      inputs: {},
      outputs: { out: { type: 'eve.quantity' } },
      uses: ['esi.public'],
      run: () => ({ out: 1 }),
    });
    expect(cap.source).toBe('ESI');
    expect(cap.auth.required).toBe(false);
    expect(cap.cost.esiCallCount).toBe(1);
    expect(cap.cache.cacheable).toBe(true);
  });

  it('derives scopes from esi:<scope> uses and keys the cache by identity', () => {
    const cap = defineCapability({
      id: 'test.wallet',
      version: 1,
      name: 'Wallet',
      description: '',
      inputs: {},
      outputs: { balance: { type: 'eve.currency.isk' } },
      uses: ['esi:esi-wallet.read_character_wallet.v1'],
      run: () => ({ balance: 0 }),
    });
    expect(cap.auth).toEqual({
      required: true,
      scopes: ['esi-wallet.read_character_wallet.v1'],
    });
    expect(cap.cache.identityInKey).toBe(true);
  });

  it('infers SDE from sde and honours explicit cache and cost settings', () => {
    const cap = defineCapability({
      id: 'test.sde',
      version: 1,
      name: 'SDE',
      description: '',
      inputs: { query: { type: 'eve.type.reference', required: false } },
      outputs: { typeId: { type: 'eve.type.reference' } },
      uses: ['sde'],
      dependencies: ['test.pure'],
      cache: { defaultTtlSeconds: 86400, stalePermitted: true },
      cost: { estimatedLatencyMs: 5 },
      run: () => ({ typeId: 34 }),
    });
    expect(cap.source).toBe('SDE');
    expect(cap.inputs.get('query')?.required).toBe(false);
    expect(cap.cache).toMatchObject({
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
    });
    expect(cap.cost.estimatedLatencyMs).toBe(5);
    expect(cap.dependencies.map((d) => d.id as string)).toEqual(['test.pure']);
  });

  it('rejects an unknown use', () => {
    expect(() =>
      defineCapability({
        id: 'test.bad',
        version: 1,
        name: 'Bad',
        description: '',
        inputs: {},
        outputs: { out: { type: 'eve.quantity' } },
        uses: ['esi.raw' as 'esi.public'],
        run: () => ({ out: 1 }),
      }),
    ).toThrow('unknown use "esi.raw"');
  });

  it('rejects a capability with no outputs', () => {
    expect(() =>
      defineCapability({
        id: 'test.none',
        version: 1,
        name: 'None',
        description: '',
        inputs: {},
        outputs: {},
        run: () => ({}),
      }),
    ).toThrow('at least one output');
  });

  it('registers in an executable catalog (FAB-VAL-01)', () => {
    const catalog = new CapabilityCatalog({ executable: true });
    expect(() => catalog.register(pure)).not.toThrow();
  });
});

describe('defineContract', () => {
  const contract = defineContract({
    id: 'test.contract',
    version: 1,
    name: 'Contract',
    description: 'No code',
    inputs: { item: { type: 'eve.type.reference', required: true } },
    outputs: { result: { type: 'eve.market.order' } },
    source: 'ESI',
    auth: { required: true, scopes: ['esi-markets.read_markets.v1'] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true, identityInKey: true },
  });

  it('describes a capability without a run', () => {
    expect(contract.source).toBe('ESI');
    expect(contract.run).toBeUndefined();
    expect(contract.auth.scopes).toEqual(['esi-markets.read_markets.v1']);
    expect(contract.cache.defaultTtlSeconds).toBe(300);
  });

  it('is refused by an executable catalog (FAB-VAL-01)', () => {
    const catalog = new CapabilityCatalog({ executable: true });
    expect(() => catalog.register(contract)).toThrow();
  });

  it('registers in a contracts-only catalog', () => {
    const catalog = new CapabilityCatalog();
    expect(() => catalog.register(contract)).not.toThrow();
  });
});

describe('definePack', () => {
  it('bundles capabilities that run', () => {
    const pack = definePack({ id: 'test-pack', capabilities: [pure] });
    expect(pack.capabilities).toEqual([pure]);
  });

  it('rejects a capability listed twice', () => {
    expect(() => definePack({ id: 'test-pack', capabilities: [pure, pure] })).toThrow(
      'lists test.pure@1.0.0 twice',
    );
  });

  it('rejects a capability without a run', () => {
    const contract = defineContract({
      id: 'test.contract',
      version: 1,
      name: 'Contract',
      description: '',
      inputs: {},
      outputs: { out: { type: 'eve.quantity' } },
      source: 'DERIVED',
    });
    expect(() => definePack({ id: 'test-pack', capabilities: [contract] })).toThrow(
      'no run function (FAB-VAL-01)',
    );
  });
});

describe('parseCapabilityManifest', () => {
  it('parses a YAML manifest into a CapabilityDefinition', () => {
    const yaml = `
id: test.parse
version: 1
name: Parse Test
description: Testing YAML parsing
source: ESI
inputs:
  item:
    type: eve.type.reference
    description: Item ref
outputs:
  result:
    type: eve.market.order
    description: Market order
`;
    const cap = parseCapabilityManifest(yaml);
    expect(cap.id).toBe('test.parse');
    expect(cap.version as string).toBe('1.0.0');
    expect(cap.inputs.get('item')?.semanticType).toBe('eve.type.reference');
    expect(cap.outputs.get('result')?.semanticType).toBe('eve.market.order');
  });

  it('throws on missing required fields', () => {
    const yaml = `
name: Missing ID
source: ESI
outputs:
  result:
    type: eve.market.order
`;
    expect(() => parseCapabilityManifest(yaml)).toThrow('missing required field');
  });
});

describe('parseCapabilityManifests', () => {
  it('parses multi-document YAML', () => {
    const yaml = `
id: cap.one
version: 1
source: ESI
outputs:
  out:
    type: eve.currency.isk
---
id: cap.two
version: 1
source: SDE
outputs:
  out:
    type: eve.type.reference
`;
    const caps = parseCapabilityManifests(yaml);
    expect(caps).toHaveLength(2);
    expect(caps[0]!.id).toBe('cap.one');
    expect(caps[1]!.id).toBe('cap.two');
  });
});
