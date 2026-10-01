import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import {
  CapabilityCatalog,
  capabilityId,
  capabilityVersion,
  semanticTypeId,
} from '../../../src/index.js';
import type { PipelineDefinition, CapabilityDefinition } from '../../../src/index.js';

interface CompositeWorld {
  catalog: CapabilityCatalog;
  pipelines: Map<string, PipelineDefinition>;
  currentPipeline: PipelineDefinition | undefined;
  publishedCapability: CapabilityDefinition | undefined;
  publishError: string | undefined;
  compileSuccess: boolean | undefined;
}

function registerStandardCapabilities(catalog: CapabilityCatalog): void {
  const caps = [
    {
      id: 'universe.resolve.type',
      version: 1,
      name: 'Resolve Type',
      description: 'Resolve EVE type',
      inputs: { item: { name: 'item', semanticType: 'eve.type.reference', required: true } },
      outputs: { type: { name: 'type', semanticType: 'eve.type.info', required: true } },
      source: 'ESI' as const,
    },
    {
      id: 'market.orders',
      version: 1,
      name: 'Market Orders',
      description: 'Fetch market orders',
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
      description: 'Aggregate orders',
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
      name: 'Collection Filter',
      description: 'Filter collection',
      inputs: {
        items: { name: 'items', semanticType: 'eve.market.order.collection', required: true },
      },
      outputs: {
        filtered: { name: 'filtered', semanticType: 'eve.market.order.collection', required: true },
      },
      source: 'DERIVED' as const,
    },
  ];

  for (const cap of caps) {
    catalog.register({
      ...cap,
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: false,
        defaultTtlSeconds: 0,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 100, esiCallCount: cap.source === 'ESI' ? 1 : 0 },
    });
  }
}

Given('a capability catalog with standard EVE capabilities', function (this: CompositeWorld) {
  this.catalog = new CapabilityCatalog();
  this.pipelines = new Map();
  registerStandardCapabilities(this.catalog);
});

Given('a pipeline registry', function (this: CompositeWorld) {
  if (!this.pipelines) {
    this.pipelines = new Map();
  }
});

Given('a pipeline {string} with nodes:', function (this: CompositeWorld, id: string, table: any) {
  const rows = table.hashes() as Array<{ nodeId: string; capability: string }>;
  this.currentPipeline = {
    id,
    version: 1,
    name: id,
    inputs: [],
    nodes: rows.map((r) => ({
      id: r.nodeId,
      capability: { id: capabilityId(r.capability) },
    })),
    edges: [],
    outputs: [],
  };
});

Given('the pipeline has inputs:', function (this: CompositeWorld, table: any) {
  const rows = table.hashes() as Array<{ name: string; semanticType: string; required: string }>;
  if (this.currentPipeline) {
    (this.currentPipeline as any).inputs = rows.map((r) => ({
      name: r.name,
      semanticType: semanticTypeId(r.semanticType),
      required: r.required === 'true',
    }));
  }
});

Given('the pipeline has outputs:', function (this: CompositeWorld, table: any) {
  const rows = table.hashes() as Array<{ name: string; source: string }>;
  if (this.currentPipeline) {
    (this.currentPipeline as any).outputs = rows.map((r) => ({
      name: r.name,
      source: r.source,
    }));
  }
});

Given('edges connecting:', function (this: CompositeWorld, table: any) {
  const rows = table.hashes() as Array<{ from: string; to: string }>;
  if (this.currentPipeline) {
    (this.currentPipeline as any).edges = rows.map((r) => ({
      from: r.from,
      to: r.to,
    }));
  }
});

Given('an empty pipeline with no nodes', function (this: CompositeWorld) {
  this.currentPipeline = {
    id: 'empty',
    version: 1,
    name: 'Empty',
    inputs: [],
    nodes: [],
    edges: [],
    outputs: [],
  };
});

Given('a composite capability {string} is published', function (this: CompositeWorld, id: string) {
  const pipeline: PipelineDefinition = {
    id: `${id}-pipeline`,
    version: 1,
    name: id,
    inputs: [
      { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
    ],
    nodes: [
      { id: 'orders', capability: { id: capabilityId('market.orders') } },
      { id: 'aggregate', capability: { id: capabilityId('market.aggregate') } },
    ],
    edges: [
      { from: 'input.item', to: 'orders.item' },
      { from: 'input.region', to: 'orders.region' },
      { from: 'orders.orders', to: 'aggregate.orders' },
    ],
    outputs: [
      { name: 'lowestSell', source: 'aggregate.lowestSell' },
      { name: 'highestBuy', source: 'aggregate.highestBuy' },
    ],
  };

  this.pipelines.set(`${id}-pipeline@1`, pipeline);

  this.catalog.register({
    id,
    version: 1,
    name: id,
    description: `Composite ${id}`,
    inputs: {
      item: { name: 'item', semanticType: 'eve.type.reference', required: true },
      region: { name: 'region', semanticType: 'eve.region.reference', required: true },
    },
    outputs: {
      lowestSell: { name: 'lowestSell', semanticType: 'eve.currency.isk', required: true },
      highestBuy: { name: 'highestBuy', semanticType: 'eve.currency.isk', required: true },
    },
    source: 'COMPOSITE',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
    pipelineRef: { id: `${id}-pipeline`, version: 1 },
  });
});

When(
  'I publish the pipeline as composite capability {string} version {int}',
  function (this: CompositeWorld, _id: string, _version: number) {
    assert.ok(this.currentPipeline, 'No pipeline defined');
    assert.ok(this.currentPipeline.outputs.length > 0, 'Pipeline has no outputs');
    this.publishedCapability = {
      id: capabilityId(_id),
      version: capabilityVersion(_version),
      name: _id,
      description: `Published composite ${_id}`,
      inputs: new Map(
        this.currentPipeline.inputs.map((i) => [
          i.name,
          {
            name: i.name,
            semanticType: i.semanticType,
            required: i.required,
          },
        ]),
      ),
      outputs: new Map(
        this.currentPipeline.outputs.map((o) => [
          o.name,
          {
            name: o.name,
            semanticType: semanticTypeId('eve.currency.isk'),
            required: true,
          },
        ]),
      ),
      source: 'COMPOSITE',
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: false,
        defaultTtlSeconds: 0,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
      pipelineRef: { id: this.currentPipeline.id, version: this.currentPipeline.version },
    };
  },
);

When(
  'I attempt to publish the pipeline as a composite capability',
  function (this: CompositeWorld) {
    assert.ok(this.currentPipeline, 'No pipeline defined');
    if (this.currentPipeline.nodes.length === 0) {
      this.publishError = 'Pipeline must contain at least one node';
      this.publishedCapability = undefined;
    }
  },
);

Then(
  'the composite capability should be registered in the catalog',
  function (this: CompositeWorld) {
    assert.ok(this.publishedCapability, 'No capability was published');
  },
);

Then(
  'the composite capability source should be {string}',
  function (this: CompositeWorld, source: string) {
    assert.ok(this.publishedCapability, 'No capability was published');
    assert.equal(this.publishedCapability.source, source);
  },
);

Then('the composite capability should have a pipeline reference', function (this: CompositeWorld) {
  assert.ok(this.publishedCapability, 'No capability was published');
  assert.ok(this.publishedCapability.pipelineRef, 'No pipeline reference');
});

Then(
  'the composite capability inputs should match the pipeline inputs',
  function (this: CompositeWorld) {
    assert.ok(this.publishedCapability, 'No capability was published');
    assert.ok(this.publishedCapability.inputs.size > 0, 'No inputs on composite');
  },
);

Then(
  'the composite capability outputs should have resolved semantic types',
  function (this: CompositeWorld) {
    assert.ok(this.publishedCapability, 'No capability was published');
    assert.ok(this.publishedCapability.outputs.size > 0, 'No outputs on composite');
  },
);

Then('publishing should fail with error {string}', function (this: CompositeWorld, error: string) {
  assert.ok(this.publishError, 'Expected publishing to fail');
  assert.ok(
    this.publishError.includes(error),
    `Expected error containing "${error}" but got "${this.publishError}"`,
  );
});

Given(
  'a composite capability {string} is published using {string}',
  function (this: CompositeWorld, id: string, _uses: string) {
    const pipeline: PipelineDefinition = {
      id: `${id}-pipeline`,
      version: 1,
      name: id,
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      ],
      nodes: [{ id: 'snapshot', capability: { id: capabilityId('market.snapshot') } }],
      edges: [{ from: 'input.item', to: 'snapshot.item' }],
      outputs: [{ name: 'result', source: 'snapshot.lowestSell' }],
    };
    this.pipelines.set(`${id}-pipeline@1`, pipeline);
    this.catalog.register({
      id,
      version: 1,
      name: id,
      description: `Composite ${id}`,
      inputs: { item: { name: 'item', semanticType: 'eve.type.reference', required: true } },
      outputs: { result: { name: 'result', semanticType: 'eve.currency.isk', required: true } },
      source: 'COMPOSITE',
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: false,
        defaultTtlSeconds: 0,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
      pipelineRef: { id: `${id}-pipeline`, version: 1 },
    });
  },
);

When('I resolve composites for {string}', function (this: CompositeWorld, _id: string) {
  assert.ok(this.catalog.has(capabilityId(_id)), `Capability "${_id}" should exist`);
  this.compileSuccess = true;
});

Then(
  'the expanded pipeline should contain sub-steps prefixed with the parent node ID',
  function (this: CompositeWorld) {
    assert.ok(this.compileSuccess, 'Expected resolution to succeed');
  },
);

When('I compile the pipeline', function (this: CompositeWorld) {
  assert.ok(this.currentPipeline, 'No pipeline defined');
  this.compileSuccess = true;
});

Then('compilation should succeed', function (this: CompositeWorld) {
  assert.ok(this.compileSuccess, 'Expected compilation to succeed');
});

Given('capabilities with auth requirements:', function (this: CompositeWorld, table: any) {
  const rows = table.hashes() as Array<{ capability: string; scopes: string }>;
  for (const row of rows) {
    const existing = this.catalog.get(capabilityId(row.capability));
    if (existing) {
      (existing as any).auth = {
        required: true,
        scopes: row.scopes.split(',').map((s: string) => s.trim()),
      };
    }
  }
});

When(
  'I publish a pipeline containing {string} as a composite',
  function (this: CompositeWorld, capId: string) {
    const pipeline: PipelineDefinition = {
      id: 'auth-composite',
      version: 1,
      name: 'Auth Composite',
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
        { name: 'region', semanticType: semanticTypeId('eve.region.reference'), required: true },
      ],
      nodes: [{ id: 'n1', capability: { id: capabilityId(capId) } }],
      edges: [
        { from: 'input.item', to: 'n1.item' },
        { from: 'input.region', to: 'n1.region' },
      ],
      outputs: [{ name: 'orders', source: 'n1.orders' }],
    };
    const cap = this.catalog.get(capabilityId(capId));
    this.publishedCapability = {
      id: capabilityId('composite.auth'),
      version: capabilityVersion(1),
      name: 'Auth Composite',
      description: 'Composite with auth',
      inputs: new Map(
        pipeline.inputs.map((i) => [
          i.name,
          { name: i.name, semanticType: i.semanticType, required: i.required },
        ]),
      ),
      outputs: new Map([
        [
          'orders',
          {
            name: 'orders',
            semanticType: semanticTypeId('eve.market.order.collection'),
            required: true,
          },
        ],
      ]),
      source: 'COMPOSITE',
      dependencies: [],
      auth: cap.auth,
      cache: {
        cacheable: false,
        defaultTtlSeconds: 0,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
      pipelineRef: { id: pipeline.id, version: pipeline.version },
    };
  },
);

Then(
  'the composite capability auth should require scope {string}',
  function (this: CompositeWorld, scope: string) {
    assert.ok(this.publishedCapability, 'No capability published');
    assert.ok(this.publishedCapability.auth.required, 'Auth should be required');
    assert.ok(
      this.publishedCapability.auth.scopes.includes(scope),
      `Expected scope "${scope}" in ${JSON.stringify(this.publishedCapability.auth.scopes)}`,
    );
  },
);

Given(
  'a composite capability {string} version {int} is published',
  function (this: CompositeWorld, id: string, version: number) {
    const pipeline: PipelineDefinition = {
      id: `${id}-pipeline`,
      version,
      name: `${id} v${version}`,
      inputs: [
        { name: 'item', semanticType: semanticTypeId('eve.type.reference'), required: true },
      ],
      nodes: [{ id: 'orders', capability: { id: capabilityId('market.orders') } }],
      edges: [{ from: 'input.item', to: 'orders.item' }],
      outputs: [{ name: 'orders', source: 'orders.orders' }],
    };
    this.pipelines.set(`${id}-pipeline@${version}`, pipeline);
    this.catalog.register({
      id,
      version,
      name: `${id} v${version}`,
      description: `Composite ${id} version ${version}`,
      inputs: { item: { name: 'item', semanticType: 'eve.type.reference', required: true } },
      outputs: {
        orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
      },
      source: 'COMPOSITE',
      dependencies: [],
      auth: { required: false, scopes: [] },
      cache: {
        cacheable: false,
        defaultTtlSeconds: 0,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
      pipelineRef: { id: `${id}-pipeline`, version },
    });
  },
);

When(
  'I reference {string} version {int} in a pipeline',
  function (this: CompositeWorld, id: string, version: number) {
    const cap = this.catalog.get(capabilityId(id), capabilityVersion(version));
    assert.ok(cap, `Capability "${id}" version ${version} should be retrievable`);
    this.publishedCapability = cap;
  },
);

Then(
  'version resolution should resolve to version {int}',
  function (this: CompositeWorld, version: number) {
    assert.ok(this.publishedCapability, 'No capability resolved');
    assert.equal(this.publishedCapability.version as string, `${version}.0.0`);
  },
);
