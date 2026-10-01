import { describe, it, expect } from 'vitest';
import {
  CapabilityNotExecutableError,
  UnknownSemanticTypeError,
  UnresolvableReferenceError,
  capabilityId,
  capabilityVersion,
  fixedClock,
  semanticTypeId,
  type PipelineDefinition,
  type PipelineNode,
} from '@eve-fabric/core';
import { z } from 'zod';
import { defineCapability, defineContract, definePack, defineType, listOf } from '@eve-fabric/kit';
import { PortValueError, StepExecutionError } from '@eve-fabric/executor';
import { corePack } from '@eve-fabric/pack-core';
import { memoryStaticSource } from '@eve-fabric/source-sde';
import {
  REGION,
  STATION,
  SYSTEM,
  TYPE,
  tranquilityEsi,
  tranquilitySde,
  tranquilitySdeData,
} from '@eve-fabric/test-support';
import {
  createFabric,
  PipelineCompileError,
  PublishRefusedError,
  ResolverMissingError,
  TypeConflictError,
} from '../src/index.js';

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
    expect(fabric.describe().capabilities).toHaveLength(
      corePack.capabilities.length + (corePack.weaves?.length ?? 0),
    );
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
    const failure = await fabric
      .run({ ...cheapestInRegion, edges: cheapestInRegion.edges.slice(1) }, {})
      .catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(PipelineCompileError);
    expect(failure).not.toBeInstanceOf(PublishRefusedError);
    expect((failure as Error).message).toMatch(/^Pipeline "cheapest-in-region" does not compile: /);
    expect((failure as PipelineCompileError).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MISSING_INPUT' }),
    );
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
    // What a third-party pack does: depend on the kit, define, install. It
    // uses the core's ISK type and defines its own for the text.
    const label = defineType({
      kind: 'value',
      id: 'someone.isk.label',
      description: 'An ISK amount written out',
      schema: z.string(),
    });
    const thirdParty = definePack({
      id: '@someone/pack-isk',
      capabilities: [
        defineCapability({
          id: 'someone.isk.format',
          version: '0.1.0',
          name: 'Format ISK',
          description: 'Formats an amount as ISK',
          inputs: { amount: { type: 'eve.currency.isk' } },
          outputs: { text: { type: label } },
          run: ({ amount }) => ({ text: `${Number(amount).toFixed(2)} ISK` }),
        }),
      ],
    });
    expect(thirdParty.types).toEqual([label]);
    const fabric = createFabric({ packs: [corePack, thirdParty] });
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
    const quote = fabric.catalog.get(capabilityId('test.freight'));
    expect(fabric.getPipeline(quote.pipelineRef!.id, quote.pipelineRef!.version)).toMatchObject({
      nodes: freight.nodes,
      edges: freight.edges,
    });
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

  it('keeps each composite to the view it was published from', async () => {
    const { fabric } = tranquilityFabric();
    const both: PipelineDefinition = {
      ...routeOnly,
      id: 'both',
      nodes: [...routeOnly.nodes, node('back', 'route.distance', '2.0.0')],
      edges: [
        ...routeOnly.edges,
        { from: 'input.destination', to: 'back.origin' },
        { from: 'input.origin', to: 'back.destination' },
      ],
      outputs: [...routeOnly.outputs, { name: 'back', source: 'back.distance' }],
    };
    const meta = { version: '1.0.0', name: 'View', description: 'One view' };
    fabric.publishComposite(
      { ...both, outputs: [both.outputs[0]!] },
      { ...meta, id: 'test.there' },
    );
    fabric.publishComposite({ ...both, outputs: [both.outputs[1]!] }, { ...meta, id: 'test.back' });
    // The second publish of the same pipeline leaves the first composite alone.
    const result = await fabric.run(
      {
        id: 'uses-there',
        version: 1,
        name: 'Uses there',
        inputs: routeOnly.inputs,
        nodes: [node('t', 'test.there', '1.0.0')],
        edges: [
          { from: 'input.origin', to: 't.origin' },
          { from: 'input.destination', to: 't.destination' },
        ],
        outputs: [{ name: 'jumps', source: 't.jumps' }],
      },
      { origin: SYSTEM.jita, destination: SYSTEM.amarr },
    );
    expect(result.outputs.get('t/route')).toEqual({ distance: 4 });
  });

  it('expands composites nested ten deep, and refuses eleven', () => {
    const { fabric } = tranquilityFabric();
    const wrap = (inner: string, version: string): PipelineDefinition => ({
      ...routeOnly,
      nodes: [node('route', inner, version)],
      outputs: [{ name: 'jumps', source: `route.${version === '2.0.0' ? 'distance' : 'jumps'}` }],
    });
    let inner = 'route.distance';
    let version = '2.0.0';
    for (let level = 1; level <= 11; level++) {
      const id = `test.level${level}`;
      fabric.publishComposite(wrap(inner, version), {
        id,
        version: '1.0.0',
        name: id,
        description: `Nested ${level} deep`,
      });
      inner = id;
      version = '1.0.0';
    }
    const uses = (level: number) => fabric.compile(wrap(`test.level${level}`, '1.0.0'));
    expect(uses(10).success).toBe(true);
    expect(uses(11).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'COMPOSITE_DEPTH_EXCEEDED' }),
    );
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

describe('types that can represent a traversal (phase 3)', () => {
  const widgetRef = (resolver?: { capability: string; input: string; output: string }) =>
    defineType({
      kind: 'reference',
      id: 'someone.widget.reference',
      description: 'A widget, by id',
      entity: 'someone.widget',
      resolver,
    });
  const widget = defineType({
    kind: 'record',
    id: 'someone.widget',
    description: 'A widget',
    fields: { widget_id: 'someone.widget.reference', name: 'eve.text' },
  });
  const makeWidget = (ref: ReturnType<typeof widgetRef>) =>
    defineCapability({
      id: 'someone.widget.make',
      version: '1.0.0',
      name: 'Make widget',
      description: 'Makes a widget id',
      inputs: {},
      outputs: { widget: { type: ref } },
      run: () => ({ widget: 1 }),
    });
  const lookUpWidget = (ref: ReturnType<typeof widgetRef>, output = 'widget') =>
    defineCapability({
      id: 'someone.widget',
      version: '1.0.0',
      name: 'Widget',
      description: 'The widget behind an id',
      inputs: { id: { type: ref } },
      outputs: { [output]: { type: widget } },
      run: ({ id }) => ({ [output]: { widget_id: id, name: 'Sprocket' } }),
    });

  it('refuses a capability that emits a reference type with no resolver', () => {
    const ref = widgetRef();
    const pack = definePack({ id: '@someone/widgets', capabilities: [makeWidget(ref)] });
    expect(() => createFabric({ packs: [corePack, pack] })).toThrow(UnresolvableReferenceError);
  });

  it('refuses a resolver that is not installed, or whose ports do not fit', () => {
    const named = widgetRef({ capability: 'someone.widget', input: 'id', output: 'widget' });
    const missing = definePack({ id: '@someone/widgets', capabilities: [makeWidget(named)] });
    expect(() => createFabric({ packs: [corePack, missing] })).toThrow(/is not installed/);

    const wrongInput = widgetRef({ capability: 'someone.widget', input: 'key', output: 'widget' });
    expect(() =>
      createFabric({
        packs: [
          corePack,
          definePack({
            id: '@someone/widgets',
            types: [widget],
            capabilities: [makeWidget(wrongInput), lookUpWidget(wrongInput)],
          }),
        ],
      }),
    ).toThrow(/no input "key"/);

    const wrongOutput = widgetRef({ capability: 'someone.widget', input: 'id', output: 'widget' });
    expect(() =>
      createFabric({
        packs: [
          corePack,
          definePack({
            id: '@someone/widgets',
            types: [widget],
            capabilities: [makeWidget(wrongOutput), lookUpWidget(wrongOutput, 'thing')],
          }),
        ],
      }),
    ).toThrow(ResolverMissingError);
  });

  it('installs nothing of a pack it refuses', () => {
    const named = widgetRef({ capability: 'someone.widget', input: 'id', output: 'widget' });
    const fabric = createFabric({ packs: [corePack] });
    const before = fabric.describe();
    const refused = definePack({
      id: '@someone/widgets',
      types: [widget],
      capabilities: [
        defineCapability({
          id: 'someone.widget.count',
          version: '1.0.0',
          name: 'Count',
          description: 'Counts widgets',
          inputs: {},
          outputs: { count: { type: 'eve.quantity' } },
          run: () => ({ count: 1 }),
        }),
        makeWidget(named),
      ],
    });
    expect(() => fabric.install(refused)).toThrow(ResolverMissingError);
    expect(fabric.describe().capabilities).toHaveLength(before.capabilities.length);
    expect(fabric.types.has('someone.widget')).toBe(false);
    expect(fabric.types.has('someone.widget.reference')).toBe(false);
  });

  it('checks resolvers for a capability registered straight into the catalog', () => {
    const named = widgetRef({ capability: 'someone.widget', input: 'id', output: 'widget' });
    const fabric = createFabric({
      packs: [
        corePack,
        definePack({ id: '@someone/widget-types', types: [widget, named], capabilities: [] }),
      ],
    });
    expect(() => fabric.catalog.register(makeWidget(named))).toThrow(ResolverMissingError);
    expect(() => fabric.registry.register(makeWidget(named))).toThrow(ResolverMissingError);
    fabric.registry.registerAll([lookUpWidget(named), makeWidget(named)]);
    expect(fabric.catalog.has(capabilityId('someone.widget.make'))).toBe(true);
  });

  it('installs a reference whose resolver is in the same pack, and follows it', async () => {
    const ref = widgetRef({ capability: 'someone.widget', input: 'id', output: 'widget' });
    const fabric = createFabric({
      packs: [
        corePack,
        definePack({
          id: '@someone/widgets',
          types: [widget],
          capabilities: [makeWidget(ref), lookUpWidget(ref)],
        }),
      ],
    });
    expect(fabric.describe().types.map((t) => t.id)).toContain('someone.widget.reference');
    const result = await fabric.run(
      {
        id: 'w',
        version: 1,
        name: 'Widget',
        inputs: [],
        nodes: [
          node('make', 'someone.widget.make', '1.0.0'),
          node('get', 'someone.widget', '1.0.0'),
        ],
        edges: [{ from: 'make.widget', to: 'get.id' }],
        outputs: [{ name: 'widget', source: 'get.widget' }],
      },
      {},
    );
    expect(result.outputs.get('get')).toEqual({ widget: { widget_id: 1, name: 'Sprocket' } });
  });

  it('reserves eve.* for the core pack and refuses a second definition of a type', () => {
    const squatter = defineType({
      kind: 'value',
      id: 'eve.squatter',
      description: 'Not ours',
      schema: z.string(),
    });
    expect(() =>
      createFabric({ packs: [definePack({ id: 'x', types: [squatter], capabilities: [] })] }),
    ).toThrow(TypeConflictError);
    const a = defineType({ kind: 'value', id: 'someone.a', description: 'A', schema: z.string() });
    const b = defineType({ kind: 'value', id: 'someone.a', description: 'B', schema: z.number() });
    const fabric = createFabric({ packs: [definePack({ id: 'x', types: [a], capabilities: [] })] });
    fabric.install(definePack({ id: 'x', types: [a], capabilities: [] })); // the same definition again is fine
    expect(() => fabric.install(definePack({ id: 'y', types: [b], capabilities: [] }))).toThrow(
      /already installed/,
    );
  });

  it('installs a pack that names a list of a type another pack installed', () => {
    const a = defineType({ kind: 'value', id: 'someone.a', description: 'A', schema: z.string() });
    const fabric = createFabric({ packs: [definePack({ id: 'x', types: [a], capabilities: [] })] });
    const many = listOf(a);
    fabric.install(definePack({ id: 'y', types: [many], capabilities: [] }));
    expect(fabric.types.get('someone.a.collection')).toBe(many);
  });

  it('refuses a port whose type it does not know', () => {
    const pack = definePack({
      id: 'x',
      capabilities: [
        defineCapability({
          id: 'someone.mystery',
          version: '1.0.0',
          name: 'Mystery',
          description: 'Speaks an unknown type',
          inputs: {},
          outputs: { out: { type: 'someone.unknown' } },
          run: () => ({ out: 1 }),
        }),
      ],
    });
    expect(() => createFabric({ packs: [pack] })).toThrow(UnknownSemanticTypeError);
  });

  it('attaches capabilities to the types they hang off', () => {
    const { fabric } = tranquilityFabric();
    const onType = fabric.catalog.attachedTo('eve.type').map((c) => c.attach?.as);
    expect(onType).toEqual(expect.arrayContaining(['orders', 'blueprint']));
    const onOrders = fabric.catalog
      .attachedTo('eve.market.order.collection')
      .map((c) => c.attach?.as);
    expect(onOrders).toEqual(expect.arrayContaining(['prices', 'spread', 'cheapest']));
  });

  it('does not compile a wrongly typed fill', () => {
    const { fabric } = tranquilityFabric();
    const orders: PipelineDefinition = {
      id: 'orders',
      version: 1,
      name: 'Orders',
      inputs: [],
      nodes: [node('orders', 'market.orders', '2.0.0')],
      edges: [],
      outputs: [{ name: 'orders', source: 'orders.orders' }],
    };
    const wrong = fabric.compile(orders, {
      configuredInputs: { orders: { region: 'The Forge', item: TYPE.tritanium } },
    });
    expect(wrong.success).toBe(false);
    expect(wrong.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_CONFIGURED_VALUE',
        location: expect.objectContaining({ nodeId: 'orders', field: 'region' }),
      }),
    );
    const right = fabric.compile(orders, {
      configuredInputs: { orders: { region: REGION.theForge, item: TYPE.tritanium } },
    });
    expect(right.success).toBe(true);
  });

  it('compiles a name filled into a lookup, which takes names', () => {
    const { fabric } = tranquilityFabric();
    const result = fabric.compile(
      {
        id: 'lookup',
        version: 1,
        name: 'Lookup',
        inputs: [],
        nodes: [node('region', 'universe.resolve.region', '2.0.0')],
        edges: [],
        outputs: [{ name: 'region', source: 'region.region' }],
      },
      { configuredInputs: { region: { query: 'The Forge' } } },
    );
    expect(result.success).toBe(true);
  });

  it('refuses a wrongly typed value at a port when it runs', async () => {
    const { fabric } = tranquilityFabric();
    const pipeline: PipelineDefinition = {
      id: 'route',
      version: 1,
      name: 'Route',
      inputs: [
        input('origin', 'eve.system.reference'),
        input('destination', 'eve.system.reference'),
      ],
      nodes: [node('route', 'route.distance', '2.0.0')],
      edges: [
        { from: 'input.origin', to: 'route.origin' },
        { from: 'input.destination', to: 'route.destination' },
      ],
      outputs: [{ name: 'jumps', source: 'route.distance' }],
    };
    const failure = await fabric
      .run(pipeline, { origin: 'Jita', destination: SYSTEM.amarr })
      .catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(StepExecutionError);
    expect((failure as Error).cause).toBeInstanceOf(PortValueError);
    expect((failure as Error).message).toContain('Input "origin" is not a eve.system.reference');
  });

  it('takes ids sent as text, and gives steps numbers', async () => {
    const { fabric } = tranquilityFabric();
    const result = await fabric.run(
      {
        id: 'orders-by-text',
        version: 1,
        name: 'Orders by text',
        inputs: [input('item', 'eve.type.reference'), input('region', 'eve.region.reference')],
        nodes: [node('orders', 'market.orders', '2.0.0')],
        edges: [
          { from: 'input.item', to: 'orders.item' },
          { from: 'input.region', to: 'orders.region' },
        ],
        outputs: [{ name: 'orders', source: 'orders.orders' }],
      },
      { item: String(TYPE.tritanium), region: String(REGION.theForge) },
    );
    const orders = result.outputs.get('orders')?.['orders'] as { type_id: number }[];
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.type_id === TYPE.tritanium)).toBe(true);
  });

  it('values orders given by hand with only what names and prices them', async () => {
    const { fabric } = tranquilityFabric();
    const order = (order_id: number, price: number, volume_remain?: number) => ({
      order_id,
      type_id: TYPE.tritanium,
      location_id: STATION.jita44,
      price,
      is_buy_order: false,
      ...(volume_remain === undefined ? {} : { volume_remain }),
    });
    const result = await fabric.run(
      {
        id: 'cargo',
        version: 1,
        name: 'Cargo',
        inputs: [input('orders', 'eve.market.order.collection')],
        nodes: [node('value', 'logistics.cargo.value', '2.0.0')],
        edges: [{ from: 'input.orders', to: 'value.orders' }],
        outputs: [{ name: 'total', source: 'value.totalValue' }],
      },
      { orders: [order(1, 4, 10), order(2, 5)] },
    );
    expect(result.outputs.get('value')).toEqual({ totalValue: 45 });
  });

  it('follows an order to its location, and the location to its system', async () => {
    const { fabric } = tranquilityFabric();
    const pipeline: PipelineDefinition = {
      id: 'follow',
      version: 1,
      name: 'Follow',
      inputs: [input('location', 'eve.location.reference')],
      nodes: [
        node('location', 'universe.location', '2.0.0'),
        node('system', 'universe.system', '2.0.0'),
      ],
      edges: [
        { from: 'input.location', to: 'location.id' },
        { from: 'input.location', to: 'system.id' },
      ],
      outputs: [{ name: 'location', source: 'location.location' }],
    };
    // Wiring a location straight into a system is a type error: it has to be followed.
    expect(fabric.compile(pipeline).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'SEMANTIC_TYPE_MISMATCH' }),
    );
    const result = await fabric.run(
      { ...pipeline, nodes: [pipeline.nodes[0]!], edges: [pipeline.edges[0]!] },
      { location: STATION.jita44 },
    );
    expect(result.outputs.get('location')).toEqual({
      location: { location_id: STATION.jita44, kind: 'station', system_id: SYSTEM.jita },
    });
  });
});
