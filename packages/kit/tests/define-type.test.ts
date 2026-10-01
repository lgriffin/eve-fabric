import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineCapability, definePack, defineType, listOf, typeIdOf } from '../src/index.js';

const text = defineType({
  kind: 'value',
  id: 'test.text',
  description: 'Text',
  schema: z.string(),
});
const placeRef = defineType({
  kind: 'reference',
  id: 'test.place.reference',
  description: 'A place',
  entity: 'test.place',
  resolver: { capability: 'test.place', input: 'id', output: 'place' },
});
const place = defineType({
  kind: 'record',
  id: 'test.place',
  description: 'A place',
  category: 'geography',
  fields: {
    place_id: placeRef,
    name: { type: text, description: 'Its name' },
    nickname: { type: 'test.text', optional: true },
  },
});

describe('defineType', () => {
  it('defines a value type with its schema, in the category its id names', () => {
    expect(text).toMatchObject({ kind: 'value', id: 'test.text', category: 'text' });
    expect(text.schema.safeParse('Jita').success).toBe(true);
  });

  it('defines a reference that names its record and resolver, an id by default', () => {
    expect(placeRef).toMatchObject({
      kind: 'reference',
      entity: 'test.place',
      resolver: { capability: 'test.place', input: 'id', output: 'place' },
    });
    expect(placeRef.schema.safeParse(60003760).success).toBe(true);
    expect(placeRef.schema.safeParse(-1).success).toBe(false);
  });

  it('defines a record whose fields are semantic types', () => {
    expect(place.category).toBe('geography');
    expect([...place.fields]).toEqual([
      ['place_id', { type: 'test.place.reference', optional: false }],
      ['name', { type: 'test.text', description: 'Its name', optional: false }],
      ['nickname', { type: 'test.text', description: undefined, optional: true }],
    ]);
  });

  it('rejects an id that is not dot notation', () => {
    expect(() =>
      defineType({ kind: 'value', id: 'Bad', description: '', schema: z.string() }),
    ).toThrow('Invalid semantic type ID');
  });
});

describe('listOf', () => {
  it('lists a type under the item id with .collection, once per item', () => {
    const places = listOf(place);
    expect(places).toMatchObject({ kind: 'list', id: 'test.place.collection', item: 'test.place' });
    expect(listOf('test.place')).toBe(places);
    expect(typeIdOf(places)).toBe('test.place.collection');
  });
});

describe('packs collect the types their capabilities name', () => {
  const placesNamed = defineCapability({
    id: 'test.places.named',
    version: '1.0.0',
    name: 'Places named',
    description: 'Places with a name',
    inputs: { name: { type: text, acceptsName: true } },
    outputs: { places: { type: listOf(place) } },
    attach: { on: place, as: 'namesakes', subject: 'name' },
    run: () => ({ places: [] }),
  });

  it('marks a port that takes a name, and records the attach by type id', () => {
    expect(placesNamed.inputs.get('name')?.acceptsName).toBe(true);
    expect(placesNamed.attach).toEqual({ on: 'test.place', as: 'namesakes', subject: 'name' });
  });

  it('gathers types from ports, record fields and list items', () => {
    const pack = definePack({ id: 'test', capabilities: [placesNamed] });
    expect(pack.types?.map((t) => t.id).sort()).toEqual([
      'test.place',
      'test.place.collection',
      'test.place.reference',
      'test.text',
    ]);
  });

  it('refuses two different definitions of one type', () => {
    const other = defineType({
      kind: 'value',
      id: 'test.text',
      description: 'Other',
      schema: z.number(),
    });
    expect(() => definePack({ id: 'test', types: [other], capabilities: [placesNamed] })).toThrow(
      'defines semantic type "test.text" twice',
    );
  });

  it('refuses an attach through a port the capability does not have', () => {
    expect(() =>
      defineCapability({
        id: 'test.bad',
        version: '1.0.0',
        name: 'Bad',
        description: 'Bad',
        inputs: { a: { type: text } },
        outputs: { b: { type: text } },
        attach: { on: place, as: 'x', subject: 'z' as 'a' },
        run: () => ({ b: '' }),
      }),
    ).toThrow('attaches through "z"');
  });
});
