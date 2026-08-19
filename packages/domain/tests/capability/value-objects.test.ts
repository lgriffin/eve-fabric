import { describe, it, expect } from 'vitest';
import {
  authRequirementSchema,
  cachePolicySchema,
  costModelSchema,
  capabilitySourceSchema,
} from '../../src/capability/value-objects.js';

describe('authRequirementSchema', () => {
  it('accepts valid auth requirement', () => {
    const result = authRequirementSchema.safeParse({
      required: true,
      scopes: ['esi-markets.structure_markets.v1'],
    });
    expect(result.success).toBe(true);
  });

  it('defaults scopes to empty array', () => {
    const result = authRequirementSchema.parse({ required: false });
    expect(result.scopes).toEqual([]);
  });

  it('rejects missing required field', () => {
    expect(authRequirementSchema.safeParse({ scopes: [] }).success).toBe(false);
  });
});

describe('cachePolicySchema', () => {
  it('accepts full cache policy', () => {
    const result = cachePolicySchema.safeParse({
      cacheable: true,
      defaultTtlSeconds: 300,
      stalePermitted: true,
      identityInKey: false,
    });
    expect(result.success).toBe(true);
  });

  it('provides defaults for optional fields', () => {
    const result = cachePolicySchema.parse({ cacheable: true });
    expect(result.defaultTtlSeconds).toBe(0);
    expect(result.stalePermitted).toBe(false);
    expect(result.identityInKey).toBe(false);
  });

  it('rejects negative TTL', () => {
    expect(
      cachePolicySchema.safeParse({
        cacheable: true,
        defaultTtlSeconds: -1,
      }).success,
    ).toBe(false);
  });
});

describe('costModelSchema', () => {
  it('accepts valid cost model', () => {
    const result = costModelSchema.safeParse({
      estimatedLatencyMs: 200,
      esiCallCount: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative latency', () => {
    expect(
      costModelSchema.safeParse({
        estimatedLatencyMs: -1,
        esiCallCount: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects negative call count', () => {
    expect(
      costModelSchema.safeParse({
        estimatedLatencyMs: 0,
        esiCallCount: -1,
      }).success,
    ).toBe(false);
  });
});

describe('capabilitySourceSchema', () => {
  it.each(['ESI', 'SDE', 'DERIVED', 'CACHE', 'COMPOSITE'] as const)(
    'accepts %s',
    (source) => {
      expect(capabilitySourceSchema.safeParse(source).success).toBe(true);
    },
  );

  it('rejects invalid source', () => {
    expect(capabilitySourceSchema.safeParse('UNKNOWN').success).toBe(false);
  });
});
