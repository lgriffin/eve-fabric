import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { capabilityId, capabilityVersion } from '../../src/capability/capability-id.js';

const validSegment = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 1,
    maxLength: 12,
  })
  .filter((s) => /^[a-z]/.test(s));

const validIdArb = fc
  .tuple(validSegment, fc.array(validSegment, { minLength: 1, maxLength: 4 }))
  .map(([first, rest]) => [first, ...rest].join('.'));

const invalidIdArb = fc.oneof(
  fc.constant(''),
  fc.constant('UPPERCASE.thing'),
  fc.constant('no-dots'),
  fc.constant('.leading.dot'),
  fc.constant('trailing.dot.'),
  fc.constant('has spaces.here'),
  fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
    minLength: 1,
    maxLength: 5,
  }),
);

describe('CapabilityId property-based tests', () => {
  it('accepts all valid dot-notation identifiers', () => {
    fc.assert(
      fc.property(validIdArb, (id) => {
        const result = capabilityId(id);
        expect(result).toBe(id);
      }),
    );
  });

  it('rejects all invalid identifiers', () => {
    fc.assert(
      fc.property(invalidIdArb, (id) => {
        expect(() => capabilityId(id)).toThrow();
      }),
    );
  });

  it('round-trips: created IDs equal their input string', () => {
    fc.assert(
      fc.property(validIdArb, (id) => {
        const result = capabilityId(id);
        expect(String(result)).toBe(id);
      }),
    );
  });
});

describe('CapabilityVersion property-based tests', () => {
  it('accepts all positive integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (v) => {
        const result = capabilityVersion(v);
        expect(result).toBe(v);
      }),
    );
  });

  it('rejects zero and negative integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100_000, max: 0 }), (v) => {
        expect(() => capabilityVersion(v)).toThrow();
      }),
    );
  });

  it('rejects non-integer numbers', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 100, noNaN: true }).filter((n) => !Number.isInteger(n)),
        (v) => {
          expect(() => capabilityVersion(v)).toThrow();
        },
      ),
    );
  });
});
