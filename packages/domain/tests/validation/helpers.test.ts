import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  dotNotationId,
  positiveInt,
  nonNegativeInt,
  semver,
  portReference,
  portReferenceWithFields,
  parsePortReference,
  validate,
} from '../../src/validation/helpers.js';

describe('Validation helpers', () => {
  describe('dotNotationId', () => {
    it('accepts "market.orders"', () => {
      expect(dotNotationId.safeParse('market.orders').success).toBe(true);
    });

    it('accepts "a.b.c"', () => {
      expect(dotNotationId.safeParse('a.b.c').success).toBe(true);
    });

    it('rejects "noDots"', () => {
      expect(dotNotationId.safeParse('noDots').success).toBe(false);
    });

    it('rejects "1.2" (starts with digit)', () => {
      expect(dotNotationId.safeParse('1.2').success).toBe(false);
    });
  });

  describe('positiveInt', () => {
    it('accepts 1', () => {
      expect(positiveInt.safeParse(1).success).toBe(true);
    });

    it('rejects 0', () => {
      expect(positiveInt.safeParse(0).success).toBe(false);
    });

    it('rejects -1', () => {
      expect(positiveInt.safeParse(-1).success).toBe(false);
    });

    it('rejects 1.5 (not integer)', () => {
      expect(positiveInt.safeParse(1.5).success).toBe(false);
    });
  });

  describe('nonNegativeInt', () => {
    it('accepts 0', () => {
      expect(nonNegativeInt.safeParse(0).success).toBe(true);
    });

    it('accepts 1', () => {
      expect(nonNegativeInt.safeParse(1).success).toBe(true);
    });

    it('rejects -1', () => {
      expect(nonNegativeInt.safeParse(-1).success).toBe(false);
    });
  });

  describe('semver', () => {
    it('accepts "1.0.0"', () => {
      expect(semver.safeParse('1.0.0').success).toBe(true);
    });

    it('rejects "1.0" (missing patch)', () => {
      expect(semver.safeParse('1.0').success).toBe(false);
    });

    it('rejects "v1.0.0" (has prefix)', () => {
      expect(semver.safeParse('v1.0.0').success).toBe(false);
    });
  });

  describe('portReference', () => {
    it('accepts "nodeId.portName"', () => {
      expect(portReference.safeParse('nodeId.portName').success).toBe(true);
    });

    it('rejects "no-dot" (no dot separator)', () => {
      expect(portReference.safeParse('no-dot').success).toBe(false);
    });

    it('refuses record fields after the port: a port is fed, or named, whole', () => {
      expect(portReference.safeParse('cheapest.cheapest.location_id').success).toBe(false);
    });

    it('takes record fields after the port where an edge reads from', () => {
      expect(portReferenceWithFields.safeParse('cheapest.cheapest.location_id').success).toBe(true);
      expect(portReferenceWithFields.safeParse('cheapest.cheapest.').success).toBe(false);
    });
  });

  describe('parsePortReference', () => {
    it('parses "nodeId.portName" into source and port', () => {
      const result = parsePortReference('nodeId.portName');
      expect(result).toEqual({ source: 'nodeId', port: 'portName' });
    });

    it('throws on "noDot" (no dot separator)', () => {
      expect(() => parsePortReference('noDot')).toThrow(Error);
    });
  });

  describe('validate', () => {
    it('returns success result for valid data', () => {
      const result = validate(z.string(), 'hello');
      expect(result).toEqual({ success: true, data: 'hello' });
    });

    it('returns failure result with errors for invalid data', () => {
      const result = validate(z.number(), 'hello' as unknown);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toHaveProperty('code');
        expect(result.errors[0]).toHaveProperty('message');
      }
    });
  });
});
