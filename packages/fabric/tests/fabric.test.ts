import { describe, it, expect } from 'vitest';
import {
  CapabilityNotExecutableError,
  capabilityId,
  capabilityVersion,
  fixedClock,
  semanticTypeId,
  type PipelineDefinition,
  type PipelineNode,
} from '@eve-fabric/domain';
import { defineCapability, defineContract, definePack } from '@eve-fabric/kit';
import { corePack } from '@eve-fabric/pack-core';
import { memoryStaticSource } from '@eve-fabric/source-sde';
import {
  REGION,
  SYSTEM,
  TYPE,
  tranquilityEsi,
  tranquilitySde,
  tranquilitySdeData,
} from '@eve-fabric/test-support';
import { createFabric, PublishRefusedError } from '../src/index.js';

function node(id: string, capability: string, version: string): PipelineNode {
  return { id, capability: { id: capabilityId(capability), version: capabilityVersion(version) } };
}

function input(name: string, type: string) {
  return { name, semanticType: semanticTypeId(type), required: true };
}

function tranquilityFabric() {
  const { esi, transport } = tranquilityEsi();
  const fabric = createFabric({
    esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
  return { fabric, transport };
}

const cheapestInRegion: PipelineDefinition = {
  id: 'cheapest-in-region',
  version: 1,
  name: 'Cheapest in region',
  inputs: [input('item', 'eve.type.reference'), input('region', 'eve.region.reference')],
  nodes: [
    node('type', 'universe.resolve.type', '2.0.0'),
    node('region', 'universe.resolve.region', '2.0.0'),
    node('orders', 'market.orders', '2.0.0'),
    node('prices', 'market.aggregate', '2.0.0'),
  ],
  edges: [
    { from: 'input.item', to: 'type.query' },
    { from: 'input.region', to: 'region.query' },
    { from: 'type.type', to: 'orders.item' },
    { from: 'region.region', to: 'orders.region' },
    { from: 'orders.orders', to: 'prices.orders' },
  ],
  outputs: [{ name: 'lowestSell', source: 'prices.lowestSell' }],
};

describe('createFabric', () => {
  it('describes the capabilities its packs installed', () => {
    const { fabric } = tranquilityFabric();
    expect(fabric.describe().capabilities).toHaveLength(corePack.capabilities.length);
  });

  it('runs a pipeline over ESI and the SDE, from names to a price', async () => {
    const { fabric, transport } = tranquilityFabric();
    const result = await fabric.run(cheapestInRegion, { item: 'Tritanium', region: 'The Forge' });

    expect(result.outputs.get('prices')).toEqual({ lowestSell: 3.98, highestBuy: 3.71 });
    // One ESI call, filtered to the item; the region is never paged whole.
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]!.url).toContain(`/markets/${REGION.theForge}/orders`);
    expect(transport.sent[0]!.url).toContain(`type_id=${TYPE.tritanium}`);
  });

  it('records the ESI compatibility date and SDE build in provenance', async () => {
    const { fabric } = tranquilityFabric();
    const result = await fabric.run(cheapestInRegion, { item: 'Tritanium', region: 'The Forge' });
    expect(result.provenance.get('orders')!.sourceVersion).toBe('esi-compat:2026-08-18');
    expect(result.provenance.get('type')!.sourceVersion).toMatch(/^sde:/);
    expect(result.provenance.get('prices')!.calculatedAt).toEqual(new Date(Date.UTC(2026, 9, 1)));
  });

  it('caches SDE steps between runs', async () => {
    const { fabric } = tranquilityFabric();
    await fabric.run(cheapestInRegion, { item: 'Tritanium', region: 'The Forge' });
    const second = await fabric.run(cheapestInRegion, { item: 'Tritanium', region: 'The Forge' });
    expect(second.metrics.cacheHits).toBe(2);
  });

  it('accepts an already wrapped SDE source', async () => {
    const fabric = createFabric({
      sde: memoryStaticSource(tranquilitySdeData()),
      packs: [corePack],
      cache: false,
    });
    const pipeline: PipelineDefinition = {
      id: 'resolve',
      version: 1,
      name: 'Resolve',
      inputs: [input('q', 'eve.system.reference')],
      nodes: [node('sys', 'universe.resolve.solar.system', '2.0.0')],
      edges: [{ from: 'input.q', to: 'sys.query' }],
      outputs: [{ name: 'system', source: 'sys.system' }],
    };
    const result = await fabric.run(pipeline, { q: 'Amarr' });
    expect(result.outputs.get('sys')).toEqual({ system: SYSTEM.amarr });
  });

  it('refuses to run a pipeline that does not compile', async () => {
    const { fabric } = tranquilityFabric();
    await expect(
      fabric.run({ ...cheapestInRegion, edges: cheapestInRegion.edges.slice(1) }, {}),
    ).rejects.toBeInstanceOf(PublishRefusedError);
  });
});

describe('the catalog gate (FAB-VAL-01)', () => {
  it('rejects a capability without a run', () => {
    const contract = defineContract({
      id: 'contract.only',
      version: 1,
      name: 'Contract only',
      description: 'No code behind it',
      inputs: {},
      outputs: { out: { type: 'eve.quantity' } },
      source: 'DERIVED',
    });
    const fabric = createFabric();
    expect(() => fabric.install({ id: 'raw', capabilities: [contract] })).toThrow(
      CapabilityNotExecutableError,
    );
  });

  it('executes a capability defined outside this repository', async () => {
    // What a third-party pack does: depend on the kit, define, install.
    const thirdParty = definePack({
      id: '@someone/pack-isk',
      capabilities: [
        defineCapability({
          id: 'someone.isk.format',
          version: '0.1.0',
          name: 'Format ISK',
          description: 'Formats an amount as ISK',
          inputs: { amount: { type: 'eve.currency.isk' } },
          outputs: { text: { type: 'eve.quantity' } },
          run: ({ amount }) => ({ text: `${Number(amount).toFixed(2)} ISK` }),
        }),
      ],
    });
    const fabric = createFabric({ packs: [thirdParty] });
    const result = await fabric.run(
      {
        id: 'format',
        version: 1,
        name: 'Format',
        inputs: [input('amount', 'eve.currency.isk')],
        nodes: [node('fmt', 'someone.isk.format', '0.1.0')],
        edges: [{ from: 'input.amount', to: 'fmt.amount' }],
        outputs: [{ name: 'text', source: 'fmt.text' }],
      },
      { amount: 1234.5 },
    );
    expect(result.outputs.get('fmt')).toEqual({ text: '1234.50 ISK' });
  });
});

describe('composites', () => {
  const routeOnly: PipelineDefinition = {
    id: 'route-only',
    version: 1,
    name: 'Route only',
    inputs: [input('origin', 'eve.system.reference'), input('destination', 'eve.system.reference')],
    nodes: [node('route', 'route.distance', '2.0.0')],
    edges: [
      { from: 'input.origin', to: 'route.origin' },
      { from: 'input.destination', to: 'route.destination' },
    ],
    outputs: [{ name: 'jumps', source: 'route.distance' }],
  };

  const freight: PipelineDefinition = {
    id: 'freight',
    version: 1,
    name: 'Freight',
    inputs: [
      input('origin', 'eve.system.reference'),
      input('destination', 'eve.system.reference'),
      input('collateral', 'eve.currency.isk'),
    ],
    nodes: [
      node('trip', 'test.route', '1.0.0'),
      node('quote', 'logistics.freight.estimate', '2.0.0'),
    ],
    edges: [
      { from: 'input.origin', to: 'trip.origin' },
      { from: 'input.destination', to: 'trip.destination' },
      { from: 'trip.jumps', to: 'quote.distance' },
      { from: 'input.collateral', to: 'quote.collateral' },
    ],
    outputs: [{ name: 'cost', source: 'quote.cost' }],
  };

  it('publishes a pipeline that compiles and expands it wherever it is used', async () => {
    const { fabric } = tranquilityFabric();
    const route = fabric.publishComposite(routeOnly, {
      id: 'test.route',
      version: '1.0.0',
      name: 'Route',
      description: 'Jumps between two systems',
    });
    expect(route.source).toBe('COMPOSITE');
    expect(route.outputs.get('jumps')?.semanticType).toBe('eve.route.distance');

    fabric.publishComposite(freight, {
      id: 'test.freight',
      version: '1.0.0',
      name: 'Freight',
      description: 'A freight quote',
    });

    const result = await fabric.run(
      {
        id: 'uses-freight',
        version: 1,
        name: 'Uses freight',
        inputs: [
          input('origin', 'eve.system.reference'),
          input('destination', 'eve.system.reference'),
          input('collateral', 'eve.currency.isk'),
        ],
        nodes: [node('f', 'test.freight', '1.0.0')],
        edges: [
          { from: 'input.origin', to: 'f.origin' },
          { from: 'input.destination', to: 'f.destination' },
          { from: 'input.collateral', to: 'f.collateral' },
        ],
        outputs: [{ name: 'cost', source: 'f.cost' }],
      },
      { origin: SYSTEM.jita, destination: SYSTEM.amarr, collateral: 100_000_000 },
    );
    // Two levels of composite expand to the steps that run.
    expect(result.outputs.get('f/quote')).toEqual({ cost: 3_000_000 });
    expect(result.outputs.get('f/trip/route')).toEqual({ distance: 4 });
    expect(fabric.getPipeline('freight', 1)).toBe(freight);
  });

  it('refuses to publish a pipeline that does not compile (the publish gate)', () => {
    const { fabric } = tranquilityFabric();
    const broken = { ...routeOnly, edges: [routeOnly.edges[0]!] };
    expect(() =>
      fabric.publishComposite(broken, {
        id: 'test.broken',
        version: '1.0.0',
        name: 'Broken',
        description: 'Missing an input',
      }),
    ).toThrow(PublishRefusedError);
    expect(fabric.catalog.has(capabilityId('test.broken'))).toBe(false);
  });

  it('reports a composite whose pipeline it does not hold', () => {
    const { fabric } = tranquilityFabric();
    fabric.publishComposite(routeOnly, {
      id: 'test.route',
      version: '1.0.0',
      name: 'Route',
      description: 'Jumps',
    });
    const orphan = createFabric({ packs: [corePack] });
    orphan.catalog.register(fabric.catalog.get(capabilityId('test.route')));
    const result = orphan.compile({
      id: 'orphan',
      version: 1,
      name: 'Orphan',
      inputs: [input('o', 'eve.system.reference'), input('d', 'eve.system.reference')],
      nodes: [node('r', 'test.route', '1.0.0')],
      edges: [
        { from: 'input.o', to: 'r.origin' },
        { from: 'input.d', to: 'r.destination' },
      ],
      outputs: [{ name: 'jumps', source: 'r.jumps' }],
    });
    expect(result.success).toBe(false);
  });
});
