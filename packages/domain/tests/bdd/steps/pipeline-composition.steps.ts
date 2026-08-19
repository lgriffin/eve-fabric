import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import { CapabilityCatalog } from '../../../src/index.js';
import { validateSemanticWiring, detectCycles, suggestIntermediates } from '@eve-fabric/compiler';
import type { CompilerDiagnostic } from '@eve-fabric/compiler';

interface PipelineWorld {
  catalog: CapabilityCatalog;
  pipeline: {
    id: string;
    version: number;
    name: string;
    inputs: Array<{ name: string; semanticType: string; required: boolean }>;
    nodes: Array<{ id: string; capability: { id: string; version: number } }>;
    edges: Array<{ from: string; to: string }>;
    outputs: Array<{ name: string; source: string }>;
  };
  diagnostics: CompilerDiagnostic[];
  suggestions: CompilerDiagnostic[];
}

function registerDefaults(catalog: CapabilityCatalog) {
  catalog.register({
    id: 'universe.resolve.region',
    version: 1,
    name: 'Resolve Region',
    description: 'Resolve region by ID',
    inputs: {
      query: { name: 'query', semanticType: 'eve.region.reference', required: true },
    },
    outputs: {
      region: { name: 'region', semanticType: 'eve.region.reference', required: true },
    },
    source: 'SDE',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
  });

  catalog.register({
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders',
    inputs: {
      region: { name: 'region', semanticType: 'eve.region.reference', required: true },
      item: { name: 'item', semanticType: 'eve.type.reference', required: true },
    },
    outputs: {
      orders: { name: 'orders', semanticType: 'eve.market.order.collection', required: true },
    },
    source: 'ESI',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 500, esiCallCount: 1 },
  });
}

Given('a capability catalog with registered capabilities', function (this: PipelineWorld) {
  this.catalog = new CapabilityCatalog();
  registerDefaults(this.catalog);
  this.diagnostics = [];
  this.suggestions = [];
});

Given('a pipeline builder', function (this: PipelineWorld) {
  this.pipeline = {
    id: 'test.pipeline',
    version: 1,
    name: 'Test Pipeline',
    inputs: [],
    nodes: [],
    edges: [],
    outputs: [],
  };
});

Given('a pipeline with nodes:', function (this: PipelineWorld, table: DataTable) {
  const rows = table.hashes();
  for (const row of rows) {
    this.pipeline.nodes.push({
      id: row['id']!,
      capability: { id: row['capability']!, version: 1 },
    });
  }
});

Given(
  'a pipeline with input {string} of type {string}',
  function (this: PipelineWorld, name: string, type: string) {
    this.pipeline.inputs.push({ name, semanticType: type, required: true });
  },
);

Given(
  'an edge from {string} to {string}',
  function (this: PipelineWorld, from: string, to: string) {
    this.pipeline.edges.push({ from, to });
  },
);

When('I validate the pipeline wiring', function (this: PipelineWorld) {
  this.diagnostics = validateSemanticWiring(this.pipeline, this.catalog);
});

When('I check for cycles', function (this: PipelineWorld) {
  this.diagnostics = detectCycles(this.pipeline);
});

When(
  'I request suggestions to bridge {string} to {string}',
  function (this: PipelineWorld, fromType: string, toType: string) {
    this.suggestions = suggestIntermediates(fromType, toType, this.catalog);
  },
);

Then('there should be {int} diagnostic(s)', function (this: PipelineWorld, count: number) {
  assert.equal(
    this.diagnostics.length,
    count,
    `Expected ${count} diagnostics but got ${this.diagnostics.length}: ${JSON.stringify(this.diagnostics)}`,
  );
});

Then('the diagnostic should have code {string}', function (this: PipelineWorld, code: string) {
  assert.ok(
    this.diagnostics.some((d) => d.code === code),
    `Expected diagnostic with code "${code}", got: ${this.diagnostics.map((d) => d.code).join(', ')}`,
  );
});

Then('a cycle should be detected', function (this: PipelineWorld) {
  assert.ok(
    this.diagnostics.some((d) => d.code === 'GRAPH_CYCLE_DETECTED'),
    'Expected a cycle to be detected',
  );
});

Then('no cycle should be detected', function (this: PipelineWorld) {
  assert.ok(
    !this.diagnostics.some((d) => d.code === 'GRAPH_CYCLE_DETECTED'),
    `Expected no cycle, but got: ${JSON.stringify(this.diagnostics)}`,
  );
});

Then('I should receive suggestions', function (this: PipelineWorld) {
  assert.ok(this.suggestions.length > 0, 'Expected at least one suggestion');
});
