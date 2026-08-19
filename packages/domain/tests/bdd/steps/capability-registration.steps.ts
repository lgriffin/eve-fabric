import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import { CapabilityCatalog, capabilityId, semanticTypeId } from '../../../src/index.js';

interface CapWorld {
  catalog: CapabilityCatalog;
  lastResult: unknown;
  lastError: Error | undefined;
  currentDef: Record<string, unknown>;
}

function baseDef(id: string, version = 1): Record<string, unknown> {
  return {
    id,
    version,
    name: id,
    description: `Capability ${id}`,
    inputs: {},
    outputs: {
      default: { name: 'default', semanticType: 'eve.type.reference', required: true },
    },
    source: 'ESI',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
  };
}

Given('a capability catalog', function (this: CapWorld) {
  this.catalog = new CapabilityCatalog();
  this.lastError = undefined;
  this.lastResult = undefined;
  this.currentDef = {};
});

Given(
  'a registered capability {string} version {int}',
  function (this: CapWorld, id: string, version: number) {
    this.catalog.register(baseDef(id, version));
  },
);

Given(
  'a registered capability {string} with input type {string}',
  function (this: CapWorld, id: string, type: string) {
    const def = baseDef(id);
    def.inputs = { input: { name: 'input', semanticType: type, required: true } };
    this.catalog.register(def);
  },
);

Given(
  'a registered capability {string} with output type {string}',
  function (this: CapWorld, id: string, type: string) {
    const def = baseDef(id);
    def.outputs = { output: { name: 'output', semanticType: type, required: true } };
    this.catalog.register(def);
  },
);

Given(
  'a registered capability {string} from source {string}',
  function (this: CapWorld, id: string, source: string) {
    const def = baseDef(id);
    def.source = source;
    this.catalog.register(def);
  },
);

Given(
  'a registered capability {string} named {string}',
  function (this: CapWorld, id: string, name: string) {
    const def = baseDef(id);
    def.name = name;
    this.catalog.register(def);
  },
);

When(
  'I register a capability {string} with:',
  function (this: CapWorld, id: string, table: DataTable) {
    const rows = table.rowsHash();
    this.currentDef = baseDef(id, rows['version'] ? Number(rows['version']) : 1);
    this.currentDef.name = rows['name'] ?? id;
    if (rows['source']) this.currentDef.source = rows['source'];
    this.currentDef.inputs = {};
    this.currentDef.outputs = {};
  },
);

When(
  'the capability has a semantic input {string} of type {string}',
  function (this: CapWorld, name: string, type: string) {
    const inputs = this.currentDef.inputs as Record<string, unknown>;
    inputs[name] = { name, semanticType: type, required: true };
  },
);

When(
  'the capability has a semantic output {string} of type {string}',
  function (this: CapWorld, name: string, type: string) {
    const outputs = this.currentDef.outputs as Record<string, unknown>;
    outputs[name] = { name, semanticType: type, required: true };
    this.catalog.register(this.currentDef);
  },
);

When(
  'I try to register {string} version {int} again',
  function (this: CapWorld, id: string, version: number) {
    try {
      this.catalog.register(baseDef(id, version));
      this.lastError = undefined;
    } catch (e) {
      this.lastError = e as Error;
    }
  },
);

When('I retrieve {string} without specifying a version', function (this: CapWorld, id: string) {
  this.lastResult = this.catalog.get(capabilityId(id));
});

When('I search for capabilities accepting {string}', function (this: CapWorld, type: string) {
  this.lastResult = this.catalog.findBySemanticInput(semanticTypeId(type));
});

When('I search for capabilities producing {string}', function (this: CapWorld, type: string) {
  this.lastResult = this.catalog.findBySemanticOutput(semanticTypeId(type));
});

When('I filter capabilities by source {string}', function (this: CapWorld, source: string) {
  this.lastResult = this.catalog.findBySource(
    source as 'ESI' | 'SDE' | 'DERIVED' | 'CACHE' | 'COMPOSITE',
  );
});

When('I search for {string}', function (this: CapWorld, query: string) {
  this.lastResult = this.catalog.search(query);
});

When(
  'I try to register a capability with an invalid ID {string}',
  function (this: CapWorld, id: string) {
    try {
      this.catalog.register({ id, version: 1, source: 'ESI' });
      this.lastError = undefined;
    } catch (e) {
      this.lastError = e as Error;
    }
  },
);

When(
  'I register a capability {string} that depends on {string}',
  function (this: CapWorld, id: string, depId: string) {
    const def = baseDef(id);
    def.dependencies = [{ id: depId, version: 1 }];
    this.catalog.register(def);
    this.lastResult = this.catalog.get(capabilityId(id));
  },
);

Then('the catalog should contain {string}', function (this: CapWorld, id: string) {
  assert.ok(this.catalog.has(capabilityId(id)));
});

Then('the capability should have {int} input(s)', function (this: CapWorld, count: number) {
  const def = this.lastResult ?? this.catalog.get(capabilityId(this.currentDef.id as string));
  assert.equal((def as { inputs: Map<string, unknown> }).inputs.size, count);
});

Then('the capability should have {int} output(s)', function (this: CapWorld, count: number) {
  const def = this.lastResult ?? this.catalog.get(capabilityId(this.currentDef.id as string));
  assert.equal((def as { outputs: Map<string, unknown> }).outputs.size, count);
});

Then('the registration should fail with {string}', function (this: CapWorld, msg: string) {
  assert.ok(this.lastError, 'Expected an error but none was thrown');
  assert.ok(
    this.lastError.message.includes(msg),
    `Expected "${msg}" in "${this.lastError.message}"`,
  );
});

Then('I should get version {int}', function (this: CapWorld, version: number) {
  const def = this.lastResult as { version: number };
  assert.equal(def.version as number, version);
});

Then('I should find {int} capability/capabilities', function (this: CapWorld, count: number) {
  assert.equal((this.lastResult as unknown[]).length, count);
});

Then('the result should include {string}', function (this: CapWorld, id: string) {
  const results = this.lastResult as { id: string }[];
  assert.ok(results.some((r) => (r.id as string) === id));
});

Then(
  'the capability should have {int} dependency/dependencies',
  function (this: CapWorld, count: number) {
    const def = this.lastResult as { dependencies: unknown[] };
    assert.equal(def.dependencies.length, count);
  },
);
