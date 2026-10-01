import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  SemanticTypeRegistry,
  UnknownSemanticTypeError,
} from '../../src/semantic-type/registry.js';
import {
  createSemanticType,
  idSchema,
  semanticTypeId,
  type SemanticTypeDefinition,
} from '../../src/semantic-type/semantic-type.js';

function makeType(id: string, category = 'test') {
  return createSemanticType({
    id,
    description: `Test type ${id}`,
    schema: z.number(),
    category,
  });
}

describe('SemanticTypeRegistry', () => {
  let registry: SemanticTypeRegistry;

  beforeEach(() => {
    registry = new SemanticTypeRegistry();
  });

  describe('register + get', () => {
    it('round-trips a registered type', () => {
      const type = makeType('test.alpha');
      registry.register(type);

      const retrieved = registry.get(semanticTypeId('test.alpha'));
      expect(retrieved).toBe(type);
    });

    it('throws on duplicate registration', () => {
      registry.register(makeType('test.alpha'));
      expect(() => registry.register(makeType('test.alpha'))).toThrow('already registered');
    });

    it('throws when getting a nonexistent type', () => {
      expect(() => registry.get(semanticTypeId('test.nonexistent'))).toThrow('not registered');
    });
  });

  describe('has', () => {
    it('returns true for registered types', () => {
      registry.register(makeType('test.alpha'));
      expect(registry.has(semanticTypeId('test.alpha'))).toBe(true);
    });

    it('returns false for unregistered types', () => {
      expect(registry.has(semanticTypeId('test.nonexistent'))).toBe(false);
    });
  });

  describe('listByCategory', () => {
    it('returns only types in the given category', () => {
      registry.register(makeType('test.alpha', 'universe'));
      registry.register(makeType('test.beta', 'market'));
      registry.register(makeType('test.gamma', 'universe'));

      const universe = registry.listByCategory('universe');
      expect(universe).toHaveLength(2);
      expect(universe.map((t) => t.id as string)).toContain('test.alpha');
      expect(universe.map((t) => t.id as string)).toContain('test.gamma');
    });

    it('returns empty array for unknown category', () => {
      registry.register(makeType('test.alpha', 'universe'));
      expect(registry.listByCategory('nonexistent')).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('returns all registered types', () => {
      registry.register(makeType('test.alpha'));
      registry.register(makeType('test.beta'));
      registry.register(makeType('test.gamma'));

      expect(registry.list()).toHaveLength(3);
    });

    it('returns empty array when no types registered', () => {
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('isCompatible', () => {
    it('returns true for same semantic type ID', () => {
      const id = semanticTypeId('eve.region.reference');
      expect(registry.isCompatible(id, id)).toBe(true);
    });

    it('returns false for different semantic type IDs', () => {
      const regionId = semanticTypeId('eve.region.reference');
      const systemId = semanticTypeId('eve.system.reference');
      expect(registry.isCompatible(regionId, systemId)).toBe(false);
    });

    it('returns false even for structurally similar types', () => {
      const typeRef = semanticTypeId('eve.type.reference');
      const regionRef = semanticTypeId('eve.region.reference');
      expect(registry.isCompatible(typeRef, regionRef)).toBe(false);
    });
  });
});

describe('SemanticTypeRegistry: references, records and lists', () => {
  const ref = (id: string, entity: string, resolver = true): SemanticTypeDefinition => ({
    kind: 'reference',
    id: semanticTypeId(id),
    description: id,
    category: 'test',
    schema: idSchema,
    entity: semanticTypeId(entity),
    resolver: resolver ? { capability: `${entity}.get`, input: 'id', output: 'record' } : undefined,
  });
  const record = (
    id: string,
    fields: Record<string, [string, boolean]>,
  ): SemanticTypeDefinition => ({
    kind: 'record',
    id: semanticTypeId(id),
    description: id,
    category: 'test',
    fields: new Map(
      Object.entries(fields).map(([name, [type, optional]]) => [
        name,
        { type: semanticTypeId(type), optional },
      ]),
    ),
  });
  const list = (item: string): SemanticTypeDefinition => ({
    kind: 'list',
    id: semanticTypeId(`${item}.collection`),
    description: item,
    category: 'test',
    item: semanticTypeId(item),
  });

  function registry(): SemanticTypeRegistry {
    const r = new SemanticTypeRegistry();
    r.register(
      createSemanticType({
        id: 'test.text',
        description: 'Text',
        schema: z.string(),
        category: 't',
      }),
    );
    r.register(ref('test.place.reference', 'test.place'));
    r.register(ref('test.owner.reference', 'test.owner', false));
    // A record that names itself through its reference, and one registered later.
    r.register(
      record('test.place', {
        place_id: ['test.place.reference', false],
        name: ['test.text', false],
        owner_id: ['test.owner.reference', true],
      }),
    );
    r.register(record('test.order', { location_id: ['test.place.reference', false] }));
    r.register(list('test.order'));
    return r;
  }

  it('checks a record field by field, naming the field that is wrong', () => {
    const r = registry();
    expect(r.check('test.place', { place_id: 1, name: 'Jita' })).toEqual({ ok: true });
    expect(r.check('test.place', { place_id: 1, name: 'Jita', owner_id: null })).toEqual({
      ok: true,
    });
    const wrong = r.check('test.place', { place_id: 'one', name: 'Jita' });
    expect(wrong.ok).toBe(false);
    expect(!wrong.ok && wrong.message).toMatch(/^place_id: /);
    expect(r.check('test.place', { name: 'Jita' }).ok).toBe(false);
  });

  it('keeps fields a record does not name, as ESI may add them', () => {
    expect(registry().check('test.place', { place_id: 1, name: 'Jita', extra: true })).toEqual({
      ok: true,
    });
  });

  it('checks a list item by item', () => {
    const r = registry();
    expect(r.check('test.order.collection', [{ location_id: 1 }, { location_id: 2 }]).ok).toBe(
      true,
    );
    const wrong = r.check('test.order.collection', [{ location_id: 1 }, { location_id: -2 }]);
    expect(!wrong.ok && wrong.message).toMatch(/^1\.location_id: /);
    expect(r.check('test.order.collection', 'orders').ok).toBe(false);
  });

  it('checks a reference as a positive integer id', () => {
    const r = registry();
    expect(r.check('test.place.reference', 60003760).ok).toBe(true);
    expect(r.check('test.place.reference', 'Jita 4-4').ok).toBe(false);
  });

  it('finds every reference a type carries, through records and lists', () => {
    const r = registry();
    expect(r.referencesIn('test.order.collection').map((t) => t.id)).toEqual([
      'test.place.reference',
    ]);
    expect(
      r
        .referencesIn('test.place')
        .map((t) => t.id)
        .sort(),
    ).toEqual(['test.owner.reference', 'test.place.reference']);
    expect(r.referencesIn('test.text')).toEqual([]);
  });

  it('names the record a reference resolves to', () => {
    const r = registry();
    expect(r.entityOf('test.place.reference')).toBe('test.place');
    expect(r.entityOf('test.place')).toBe('test.place');
  });

  it('reports a field whose type is not registered when it is checked', () => {
    const r = new SemanticTypeRegistry();
    r.register(record('test.orphan', { x: ['test.missing', false] }));
    expect(() => r.check('test.orphan', { x: 1 })).toThrow(UnknownSemanticTypeError);
    expect(() => r.schemaOf('test.nothing')).toThrow('not registered');
  });
});
