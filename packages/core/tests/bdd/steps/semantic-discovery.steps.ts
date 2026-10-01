import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import { CapabilityCatalog, semanticTypeId } from '../../../src/index.js';
import { DiscoveryEngine } from '../../../src/discovery/discovery-engine.js';
import type { DiscoverySuggestion, SemanticPath } from '../../../src/discovery/discovery-types.js';

interface DiscoveryWorld {
  engine: DiscoveryEngine;
  suggestions: DiscoverySuggestion[];
  paths: SemanticPath[];
}

function buildCapDef(
  id: string,
  name: string,
  inputType: string,
  outputType: string,
): Record<string, unknown> {
  return {
    id,
    version: 1,
    name,
    description: `${name} capability`,
    inputs: {
      input: { name: 'input', semanticType: inputType, required: true },
    },
    outputs: {
      output: { name: 'output', semanticType: outputType, required: true },
    },
    source: 'DERIVED',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
  };
}

Given(
  'a discovery engine with the following capabilities:',
  function (this: DiscoveryWorld, table: DataTable) {
    const catalog = new CapabilityCatalog();
    for (const row of table.hashes()) {
      catalog.register(buildCapDef(row.id!, row.name!, row.inputType!, row.outputType!));
    }
    this.engine = new DiscoveryEngine(catalog);
    this.suggestions = [];
    this.paths = [];
  },
);

When('I query consumers for semantic type {string}', function (this: DiscoveryWorld, type: string) {
  this.suggestions = this.engine.findConsumers(semanticTypeId(type));
});

When(
  'I find paths from {string} to {string}',
  function (this: DiscoveryWorld, from: string, to: string) {
    this.paths = this.engine.findPaths(semanticTypeId(from), semanticTypeId(to));
  },
);

Then('I should get {int} suggestion(s)', function (this: DiscoveryWorld, count: number) {
  assert.strictEqual(this.suggestions.length, count);
});

Then('the first suggestion should be {string}', function (this: DiscoveryWorld, name: string) {
  assert.ok(this.suggestions.length > 0, 'No suggestions found');
  assert.strictEqual(this.suggestions[0]!.capabilityName, name);
});

Then('I should get {int} path(s)', function (this: DiscoveryWorld, count: number) {
  assert.strictEqual(this.paths.length, count);
});

Then('I should get at least {int} path(s)', function (this: DiscoveryWorld, count: number) {
  assert.ok(
    this.paths.length >= count,
    `Expected at least ${count} paths, got ${this.paths.length}`,
  );
});

Then(
  'the first path should have {int} step(s) via {string}',
  function (this: DiscoveryWorld, steps: number, capName: string) {
    assert.ok(this.paths.length > 0, 'No paths found');
    assert.strictEqual(this.paths[0]!.steps.length, steps);
    assert.strictEqual(this.paths[0]!.steps[0]!.capabilityName, capName);
  },
);

Then('the first path should have {int} step(s)', function (this: DiscoveryWorld, steps: number) {
  assert.ok(this.paths.length > 0, 'No paths found');
  assert.strictEqual(this.paths[0]!.steps.length, steps);
});
