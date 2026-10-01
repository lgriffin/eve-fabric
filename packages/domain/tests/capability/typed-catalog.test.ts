import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CapabilityCatalog,
  InvalidAttachError,
  UnresolvableReferenceError,
} from '../../src/capability/catalog.js';
import type {
  CapabilityAttach,
  CapabilityDefinition,
} from '../../src/capability/capability-definition.js';
import { capabilityId, capabilityVersion } from '../../src/capability/capability-id.js';
import type { SemanticPort } from '../../src/capability/semantic-port.js';
import {
  SemanticTypeRegistry,
  UnknownSemanticTypeError,
} from '../../src/semantic-type/registry.js';
import {
  createSemanticType,
  idSchema,
  semanticTypeId,
} from '../../src/semantic-type/semantic-type.js';

function ports(record: Record<string, string>): ReadonlyMap<string, SemanticPort> {
  return new Map(
    Object.entries(record).map(([name, type]) => [
      name,
      { name, semanticType: semanticTypeId(type), required: true },
    ]),
  );
}

function capability(
  id: string,
  inputs: Record<string, string>,
  outputs: Record<string, string>,
  attach?: { on: string; as: string; subject: string },
): CapabilityDefinition {
  return {
    id: capabilityId(id),
    version: capabilityVersion('1.0.0'),
    name: id,
    description: id,
    inputs: ports(inputs),
    outputs: ports(outputs),
    source: 'DERIVED',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
    attach:
      attach === undefined
        ? undefined
        : ({ ...attach, on: semanticTypeId(attach.on) } satisfies CapabilityAttach),
  };
}

function types(): SemanticTypeRegistry {
  const r = new SemanticTypeRegistry();
  r.register(
    createSemanticType({ id: 'test.text', description: 'Text', schema: z.string(), category: 't' }),
  );
  for (const [id, resolver] of [
    ['test.place', true],
    ['test.secret', false],
  ] as const) {
    r.register({
      kind: 'reference',
      id: semanticTypeId(`${id}.reference`),
      description: id,
      category: 't',
      schema: idSchema,
      entity: semanticTypeId(id),
      resolver: resolver ? { capability: `${id}.get`, input: 'id', output: 'record' } : undefined,
    });
    r.register({
      kind: 'record',
      id: semanticTypeId(id),
      description: id,
      category: 't',
      fields: new Map([['name', { type: semanticTypeId('test.text'), optional: false }]]),
    });
  }
  r.register({
    kind: 'record',
    id: semanticTypeId('test.order'),
    description: 'An order',
    category: 't',
    fields: new Map([
      ['hidden_in', { type: semanticTypeId('test.secret.reference'), optional: true }],
    ]),
  });
  return r;
}

describe('a catalog with types', () => {
  it('registers a capability whose ports it knows', () => {
    const catalog = new CapabilityCatalog({ types: types() });
    catalog.register(
      capability('test.name', { place: 'test.place.reference' }, { name: 'test.text' }),
    );
    expect(catalog.list()).toHaveLength(1);
    expect(catalog.types).toBeDefined();
  });

  it('refuses a port whose type is unknown, naming the port', () => {
    const catalog = new CapabilityCatalog({ types: types() });
    expect(() =>
      catalog.register(capability('test.x', { a: 'test.nothing' }, { b: 'test.text' })),
    ).toThrow(UnknownSemanticTypeError);
    expect(() => catalog.register(capability('test.x', {}, { b: 'test.nothing' }))).toThrow(
      /output "b" of test\.x/,
    );
  });

  it('refuses a capability that emits a reference with no resolver, even inside a record', () => {
    const catalog = new CapabilityCatalog({ types: types() });
    expect(() =>
      catalog.register(capability('test.leak', {}, { s: 'test.secret.reference' })),
    ).toThrow(UnresolvableReferenceError);
    expect(() => catalog.register(capability('test.leak', {}, { o: 'test.order' }))).toThrow(
      /emits "test\.secret\.reference" on "o"/,
    );
    // Taking one in is fine: there is nothing to follow.
    catalog.register(capability('test.sink', { s: 'test.secret.reference' }, { n: 'test.text' }));
  });

  it('takes port types on trust without types', () => {
    const catalog = new CapabilityCatalog();
    catalog.register(capability('test.x', { a: 'test.nothing' }, { b: 'test.secret.reference' }));
    expect(catalog.types).toBeUndefined();
  });

  describe('attach', () => {
    it('hangs a capability on the type its subject is, or refers to', () => {
      const catalog = new CapabilityCatalog({ types: types() });
      catalog.register(
        capability(
          'test.by.ref',
          { place: 'test.place.reference' },
          { n: 'test.text' },
          {
            on: 'test.place',
            as: 'label',
            subject: 'place',
          },
        ),
      );
      catalog.register(
        capability(
          'test.by.record',
          { place: 'test.place' },
          { n: 'test.text' },
          {
            on: 'test.place',
            as: 'title',
            subject: 'place',
          },
        ),
      );
      expect(catalog.attachedTo('test.place').map((c) => c.attach?.as)).toEqual(['label', 'title']);
      expect(catalog.attachedTo('test.text')).toEqual([]);
    });

    it('refuses an attach that does not fit', () => {
      const catalog = new CapabilityCatalog({ types: types() });
      const attempt = (inputs: Record<string, string>, on: string, subject: string) => () =>
        catalog.register(
          capability('test.bad', inputs, { n: 'test.text' }, { on, as: 'x', subject }),
        );
      expect(attempt({ p: 'test.place.reference' }, 'test.nowhere', 'p')).toThrow(
        /not a known type/,
      );
      expect(attempt({ p: 'test.place.reference' }, 'test.place', 'q')).toThrow(
        /not one of its inputs/,
      );
      expect(attempt({ p: 'test.text' }, 'test.place', 'p')).toThrow(InvalidAttachError);
    });

    it('refuses a second capability taking a name already taken on a type', () => {
      const catalog = new CapabilityCatalog({ types: types() });
      const att = { on: 'test.place', as: 'label', subject: 'p' };
      catalog.register(
        capability('test.one', { p: 'test.place.reference' }, { n: 'test.text' }, att),
      );
      expect(() =>
        catalog.register(
          capability('test.two', { p: 'test.place.reference' }, { n: 'test.text' }, att),
        ),
      ).toThrow(/already has "label", attached by "test\.one"/);
    });
  });
});
