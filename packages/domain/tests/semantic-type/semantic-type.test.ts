import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createSemanticType, semanticTypeId } from '../../src/semantic-type/semantic-type.js';

describe('semanticTypeId', () => {
  it('accepts valid dot-notation IDs', () => {
    expect(() => semanticTypeId('eve.region.reference')).not.toThrow();
    expect(() => semanticTypeId('eve.type.reference')).not.toThrow();
    expect(() => semanticTypeId('market.orders')).not.toThrow();
    expect(() => semanticTypeId('a.b')).not.toThrow();
    expect(() => semanticTypeId('foo123.bar456')).not.toThrow();
  });

  it('returns the string as a branded type', () => {
    const id = semanticTypeId('eve.region.reference');
    expect(id as string).toBe('eve.region.reference');
  });

  it('rejects empty string', () => {
    expect(() => semanticTypeId('')).toThrow('Invalid semantic type ID');
  });

  it('rejects single segment (no dots)', () => {
    expect(() => semanticTypeId('region')).toThrow('Invalid semantic type ID');
  });

  it('rejects uppercase characters', () => {
    expect(() => semanticTypeId('Eve.Region')).toThrow('Invalid semantic type ID');
  });

  it('rejects special characters', () => {
    expect(() => semanticTypeId('eve.region-reference')).toThrow('Invalid semantic type ID');
    expect(() => semanticTypeId('eve.region_reference')).toThrow('Invalid semantic type ID');
    expect(() => semanticTypeId('eve.region reference')).toThrow('Invalid semantic type ID');
  });

  it('rejects leading numbers in segments', () => {
    expect(() => semanticTypeId('1eve.region')).toThrow('Invalid semantic type ID');
    expect(() => semanticTypeId('eve.1region')).toThrow('Invalid semantic type ID');
  });

  it('rejects trailing dots', () => {
    expect(() => semanticTypeId('eve.region.')).toThrow('Invalid semantic type ID');
  });

  it('rejects leading dots', () => {
    expect(() => semanticTypeId('.eve.region')).toThrow('Invalid semantic type ID');
  });

  it('rejects consecutive dots', () => {
    expect(() => semanticTypeId('eve..region')).toThrow('Invalid semantic type ID');
  });
});

describe('createSemanticType', () => {
  it('creates a valid semantic type definition', () => {
    const type = createSemanticType({
      id: 'eve.region.reference',
      description: 'Reference to an EVE region',
      schema: z.number().int().positive(),
      category: 'universe',
    });

    expect(type.id as string).toBe('eve.region.reference');
    expect(type.description).toBe('Reference to an EVE region');
    expect(type.category).toBe('universe');
  });

  it('validates correct values through schema', () => {
    const type = createSemanticType({
      id: 'eve.region.reference',
      description: 'Reference to an EVE region',
      schema: z.number().int().positive(),
      category: 'universe',
    });

    const result = type.schema.safeParse(10000002);
    expect(result.success).toBe(true);
  });

  it('rejects incorrect values through schema', () => {
    const type = createSemanticType({
      id: 'eve.region.reference',
      description: 'Reference to an EVE region',
      schema: z.number().int().positive(),
      category: 'universe',
    });

    expect(type.schema.safeParse(-1).success).toBe(false);
    expect(type.schema.safeParse(0).success).toBe(false);
    expect(type.schema.safeParse(1.5).success).toBe(false);
    expect(type.schema.safeParse('not a number').success).toBe(false);
  });

  it('throws on invalid ID', () => {
    expect(() =>
      createSemanticType({
        id: 'INVALID',
        description: 'Bad ID',
        schema: z.number(),
        category: 'test',
      }),
    ).toThrow('Invalid semantic type ID');
  });
});
