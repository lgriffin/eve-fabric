import { describe, it, expect } from 'vitest';
import { Kind } from 'graphql';
import {
  ISKScalar,
  TypeReferenceScalar,
  RegionReferenceScalar,
  SystemReferenceScalar,
  LocationReferenceScalar,
  SEMANTIC_SCALARS,
  getScalarForSemanticType,
} from '../src/scalars.js';

describe('ISKScalar', () => {
  it('serializes a number as-is', () => {
    expect(ISKScalar.serialize(42.5)).toBe(42.5);
  });

  it('serializes null for non-numbers', () => {
    expect(ISKScalar.serialize('hello')).toBeNull();
  });

  it('parses a numeric value', () => {
    expect(ISKScalar.parseValue(100.25)).toBe(100.25);
  });

  it('throws on non-numeric parseValue', () => {
    expect(() => ISKScalar.parseValue('bad')).toThrow();
  });

  it('parses FLOAT literals', () => {
    const result = ISKScalar.parseLiteral({ kind: Kind.FLOAT, value: '3.14' }, {});
    expect(result).toBeCloseTo(3.14);
  });

  it('parses INT literals', () => {
    const result = ISKScalar.parseLiteral({ kind: Kind.INT, value: '42' }, {});
    expect(result).toBe(42);
  });
});

describe('TypeReferenceScalar', () => {
  it('serializes an integer', () => {
    expect(TypeReferenceScalar.serialize(34)).toBe(34);
  });

  it('parses an integer value', () => {
    expect(TypeReferenceScalar.parseValue(587)).toBe(587);
  });

  it('parses INT literals', () => {
    const result = TypeReferenceScalar.parseLiteral({ kind: Kind.INT, value: '12345' }, {});
    expect(result).toBe(12345);
  });

  it('returns null for non-INT literals', () => {
    const result = TypeReferenceScalar.parseLiteral({ kind: Kind.STRING, value: 'nope' }, {});
    expect(result).toBeNull();
  });
});

describe('RegionReferenceScalar', () => {
  it('serializes an integer', () => {
    expect(RegionReferenceScalar.serialize(10000002)).toBe(10000002);
  });
});

describe('SystemReferenceScalar', () => {
  it('serializes an integer', () => {
    expect(SystemReferenceScalar.serialize(30000142)).toBe(30000142);
  });
});

describe('LocationReferenceScalar', () => {
  it('serializes an integer', () => {
    expect(LocationReferenceScalar.serialize(60003760)).toBe(60003760);
  });
});

describe('SEMANTIC_SCALARS map', () => {
  it('contains all expected semantic type mappings', () => {
    expect(SEMANTIC_SCALARS.get('eve.currency.isk')).toBe(ISKScalar);
    expect(SEMANTIC_SCALARS.get('eve.type.reference')).toBe(TypeReferenceScalar);
    expect(SEMANTIC_SCALARS.get('eve.region.reference')).toBe(RegionReferenceScalar);
    expect(SEMANTIC_SCALARS.get('eve.system.reference')).toBe(SystemReferenceScalar);
    expect(SEMANTIC_SCALARS.get('eve.location.reference')).toBe(LocationReferenceScalar);
  });

  it('has at least 5 entries', () => {
    expect(SEMANTIC_SCALARS.size).toBeGreaterThanOrEqual(5);
  });
});

describe('getScalarForSemanticType', () => {
  it('returns ISKScalar for eve.currency.isk', () => {
    expect(getScalarForSemanticType('eve.currency.isk')).toBe(ISKScalar);
  });

  it('returns undefined for unknown types', () => {
    expect(getScalarForSemanticType('unknown.type')).toBeUndefined();
  });
});
