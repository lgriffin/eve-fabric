import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  authRequirementSchema,
  cachePolicySchema,
  costModelSchema,
} from '../../src/capability/value-objects.js';

const authRequirementArb = fc.record({
  required: fc.boolean(),
  scopes: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }),
});

const cachePolicyArb = fc.record({
  cacheable: fc.boolean(),
  defaultTtlSeconds: fc.nat({ max: 86400 }),
  stalePermitted: fc.boolean(),
  identityInKey: fc.boolean(),
});

const costModelArb = fc.record({
  estimatedLatencyMs: fc.nat({ max: 60_000 }),
  esiCallCount: fc.nat({ max: 100 }),
});

describe('AuthRequirement schema property tests', () => {
  it('parses all well-formed auth requirements', () => {
    fc.assert(
      fc.property(authRequirementArb, (input) => {
        const result = authRequirementSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
    );
  });

  it('preserves required and scopes through parse', () => {
    fc.assert(
      fc.property(authRequirementArb, (input) => {
        const result = authRequirementSchema.parse(input);
        expect(result.required).toBe(input.required);
        expect(result.scopes).toEqual(input.scopes);
      }),
    );
  });
});

describe('CachePolicy schema property tests', () => {
  it('parses all well-formed cache policies', () => {
    fc.assert(
      fc.property(cachePolicyArb, (input) => {
        const result = cachePolicySchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
    );
  });

  it('ttl is always non-negative after parse', () => {
    fc.assert(
      fc.property(cachePolicyArb, (input) => {
        const result = cachePolicySchema.parse(input);
        expect(result.defaultTtlSeconds).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('CostModel schema property tests', () => {
  it('parses all well-formed cost models', () => {
    fc.assert(
      fc.property(costModelArb, (input) => {
        const result = costModelSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
    );
  });

  it('rejects negative latency', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10000, max: -1 }), (latency) => {
        const result = costModelSchema.safeParse({
          estimatedLatencyMs: latency,
          esiCallCount: 1,
        });
        expect(result.success).toBe(false);
      }),
    );
  });
});
