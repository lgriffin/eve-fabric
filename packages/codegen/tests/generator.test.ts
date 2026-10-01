import { describe, it, expect } from 'vitest';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
} from '@eve-fabric/core';
import type {
  CapabilityDefinition,
  PipelineDefinition,
  ExecutionPlan,
  SemanticPort,
} from '@eve-fabric/core';
import { generate } from '../src/generator.js';
import { semanticTypeToTs } from '../src/type-mapper.js';
import { emitPipelineYaml } from '../src/emit-pipeline-yaml.js';
import { emitPackageJson } from '../src/emit-package-json.js';
import { emitIndexTs } from '../src/emit-index-ts.js';

function port(name: string, type: string, required = true): [string, SemanticPort] {
  return [name, { name, semanticType: semanticTypeId(type), required }];
}

function makeCapability(
  id: string,
  source: 'ESI' | 'SDE' | 'DERIVED',
  inputs: [string, SemanticPort][],
  outputs: [string, SemanticPort][],
): CapabilityDefinition {
  return {
    id: capabilityId(id),
    version: capabilityVersion('1.0.0'),
    name: id,
    description: `Test capability ${id}`,
    inputs: new Map(inputs),
    outputs: new Map(outputs),
    source,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 100, esiCallCount: source === 'ESI' ? 1 : 0 },
  };
}

function makePipeline(): PipelineDefinition {
  return {
    id: 'market-snapshot',
    version: 1,
    name: 'Market Snapshot',
    description: 'Get a snapshot of market data for an item in a region',
    inputs: [
      { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
    ],
    nodes: [
      {
        id: 'resolve-item',
        capability: { id: capabilityId('universe.resolve'), version: capabilityVersion('1.0.0') },
      },
      {
        id: 'orders',
        capability: { id: capabilityId('market.orders'), version: capabilityVersion('1.0.0') },
      },
    ],
    edges: [
      { from: 'input.item', to: 'resolve-item.item' },
      { from: 'resolve-item.type', to: 'orders.item' },
      { from: 'input.region', to: 'orders.region' },
    ],
    outputs: [{ name: 'orders', source: 'orders.orders' }],
  };
}

function makePlan(): ExecutionPlan {
  return {
    id: 'plan-market-snapshot-v1',
    pipelineRef: { id: 'market-snapshot', version: 1 },
    steps: [
      {
        id: 'resolve-item',
        capability: { id: capabilityId('universe.resolve'), version: capabilityVersion('1.0.0') },
        inputs: [{ portName: 'item', source: 'pipeline-input', pipelineInputName: 'item' }],
        dependsOn: [],
        canParallelize: true,
      },
      {
        id: 'orders',
        capability: { id: capabilityId('market.orders'), version: capabilityVersion('1.0.0') },
        inputs: [
          {
            portName: 'item',
            source: 'step-output',
            stepId: 'resolve-item',
            outputPortName: 'type',
          },
          { portName: 'region', source: 'pipeline-input', pipelineInputName: 'region' },
        ],
        dependsOn: ['resolve-item'],
        canParallelize: false,
      },
    ],
    parallelGroups: [],
    sourceRequirements: [
      { source: 'SDE', capabilities: [{ id: capabilityId('universe.resolve') }] },
      { source: 'ESI', capabilities: [{ id: capabilityId('market.orders') }] },
    ],
    authRequirements: { required: true, scopes: ['esi-markets.structure_markets.v1'] },
    cacheStrategy: [],
    costEstimate: { totalLatencyMs: 600, esiCallCount: 1, parallelLatencyMs: 500 },
    createdAt: new Date('2026-08-21T00:00:00.000Z'),
  };
}

function makeCatalog(): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  catalog.register(
    makeCapability(
      'universe.resolve',
      'SDE',
      [port('item', 'eve.type.reference')],
      [port('type', 'eve.type.reference')],
    ),
  );
  catalog.register(
    makeCapability(
      'market.orders',
      'ESI',
      [port('item', 'eve.type.reference'), port('region', 'eve.region.reference')],
      [port('orders', 'eve.market.order.collection')],
    ),
  );
  return catalog;
}

describe('generate', () => {
  it('produces all expected files', () => {
    const bundle = generate({
      pipeline: makePipeline(),
      plan: makePlan(),
      catalog: makeCatalog(),
      packageName: 'market-snapshot',
    });

    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain('pipeline.yaml');
    expect(paths).toContain('index.ts');
    expect(paths).toContain('package.json');
  });

  it('includes schema.graphql when graphqlSdl is provided', () => {
    const sdl = 'type Query { marketSnapshot: MarketSnapshot! }';
    const bundle = generate({
      pipeline: makePipeline(),
      plan: makePlan(),
      catalog: makeCatalog(),
      packageName: 'market-snapshot',
      graphqlSdl: sdl,
    });

    const schemaFile = bundle.files.find((f) => f.path === 'schema.graphql');
    expect(schemaFile).toBeDefined();
    expect(schemaFile!.content).toBe(sdl);
  });

  it('omits schema.graphql when no SDL provided', () => {
    const bundle = generate({
      pipeline: makePipeline(),
      plan: makePlan(),
      catalog: makeCatalog(),
      packageName: 'market-snapshot',
    });

    const schemaFile = bundle.files.find((f) => f.path === 'schema.graphql');
    expect(schemaFile).toBeUndefined();
  });
});

describe('emitIndexTs', () => {
  const pipeline = makePipeline();
  const plan = makePlan();
  const catalog = makeCatalog();

  const capabilities = plan.steps.map((s) => catalog.get(s.capability.id, s.capability.version));

  const output = emitIndexTs(pipeline, plan, capabilities);

  it('generates a valid function name from pipeline id', () => {
    expect(output).toContain('export async function marketSnapshot(');
  });

  it('generates a typed input interface', () => {
    expect(output).toContain('export interface MarketSnapshotInput');
    expect(output).toContain('item: number;');
    expect(output).toContain('region: number;');
  });

  it('includes semantic type comments on input fields', () => {
    expect(output).toContain('/** eve.type.reference */');
    expect(output).toContain('/** eve.region.reference */');
  });

  it('runs on a fabric with the core pack and carries no capability code', () => {
    expect(output).toContain(
      "import { createFabric, type Fabric, type FabricOptions } from '@eve-fabric/fabric';",
    );
    expect(output).toContain("import { corePack } from '@eve-fabric/pack-core';");
    expect(output).toContain('packs: [corePack, ...(options.packs ?? [])]');
    expect(output).not.toContain('defineCapability(');
  });

  it('names each pinned capability in the header', () => {
    expect(output).toContain('universe.resolve@');
    expect(output).toContain('market.orders@');
  });

  it('gives ESI a user agent and loads the SDE only when the plan needs them', () => {
    expect(output).toContain('createEsi({');
    expect(output).toContain("process.env['ESI_USER_AGENT']");
    expect(output).toContain('lazySdeDirectory');
  });

  it('builds its fabric once per options object and reuses it', () => {
    expect(output).toContain('const fabrics = new WeakMap<FabricOptions, Fabric>();');
    expect(output).toContain('options: FabricOptions = DEFAULT_OPTIONS,');
    expect(output).toContain('return fabricFor(options).execute(plan,');
    expect(output).not.toMatch(/export async function[^]*createFabric\(/);
  });

  it('refuses a fabric missing a pinned capability when it is built', () => {
    expect(output).toMatch(/const PINNED: .* = \[\["universe\.resolve","/);
    expect(output).toContain('which no installed pack provides; pass the packs');
  });

  it('inlines the execution plan', () => {
    expect(output).toContain('"plan-market-snapshot-v1"');
    expect(output).toContain('as unknown as ExecutionPlan');
  });

  it('serializes createdAt as new Date()', () => {
    expect(output).toContain('new Date("2026-08-21T00:00:00.000Z")');
  });

  it('includes the default export', () => {
    expect(output).toContain('export default marketSnapshot;');
  });

  it('includes header comment with pipeline name', () => {
    expect(output).toContain('* Market Snapshot');
    expect(output).toContain('pipeline.yaml');
  });
});

describe('emitPipelineYaml', () => {
  it('produces valid YAML with all pipeline sections', () => {
    const yaml = emitPipelineYaml(makePipeline());

    expect(yaml).toContain('id: market-snapshot');
    expect(yaml).toContain('name: Market Snapshot');
    expect(yaml).toContain('name: item');
    expect(yaml).toContain('name: region');
    expect(yaml).toContain('id: resolve-item');
    expect(yaml).toContain('from: input.item');
    expect(yaml).toContain('to: resolve-item.item');
    expect(yaml).toContain('source: orders.orders');
  });

  it('includes description when present', () => {
    const yaml = emitPipelineYaml(makePipeline());
    expect(yaml).toContain('snapshot of market data');
  });
});

describe('emitPackageJson', () => {
  it('generates correct package name with scope', () => {
    const json = emitPackageJson(
      {
        packageName: 'market-snapshot',
        packageScope: '@my-corp',
        version: '1.0.0',
        description: 'test',
      },
      makePlan(),
    );
    const pkg = JSON.parse(json);
    expect(pkg.name).toBe('@my-corp/market-snapshot');
  });

  it('generates correct package name without scope', () => {
    const json = emitPackageJson(
      { packageName: 'market-snapshot', version: '1.0.0', description: 'test' },
      makePlan(),
    );
    const pkg = JSON.parse(json);
    expect(pkg.name).toBe('market-snapshot');
  });

  it('depends on the fabric, the core pack and the sources the plan needs', () => {
    const json = emitPackageJson(
      { packageName: 'test', version: '1.0.0', description: 'test' },
      makePlan(),
    );
    const pkg = JSON.parse(json);
    expect(pkg.dependencies['@eve-fabric/fabric']).toBeDefined();
    expect(pkg.dependencies['@eve-fabric/pack-core']).toBeDefined();
    expect(pkg.dependencies['@lgriffin/esi.ts']).toBe('11.1.1');
    expect(pkg.dependencies['@eve-fabric/source-sde']).toBeDefined();
  });
});

describe('semanticTypeToTs', () => {
  it('maps known semantic types to TypeScript types', () => {
    expect(semanticTypeToTs('eve.type.reference')).toBe('number');
    expect(semanticTypeToTs('eve.region.reference')).toBe('number');
    expect(semanticTypeToTs('eve.timestamp')).toBe('string');
    expect(semanticTypeToTs('eve.market.order.collection')).toBe('Record<string, unknown>[]');
  });

  it('falls back to unknown for unrecognized types', () => {
    expect(semanticTypeToTs('custom.weird.type')).toBe('unknown');
  });
});
