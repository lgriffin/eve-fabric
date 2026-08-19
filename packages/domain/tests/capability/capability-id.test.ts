import { describe, it, expect } from 'vitest';
import {
  capabilityId,
  capabilityVersion,
  capabilityIdSchema,
  capabilityVersionSchema,
} from '../../src/capability/capability-id.js';

describe('capabilityId', () => {
  it('accepts valid dot-notation IDs', () => {
    expect(() => capabilityId('market.orders')).not.toThrow();
    expect(() => capabilityId('universe.types.get')).not.toThrow();
    expect(() => capabilityId('eve.sde.lookup')).not.toThrow();
  });

  it('returns a branded string', () => {
    const id = capabilityId('market.orders');
    expect(id as string).toBe('market.orders');
  });

  it('rejects single segment', () => {
    expect(() => capabilityId('market')).toThrow('Invalid capability ID');
  });

  it('rejects uppercase', () => {
    expect(() => capabilityId('Market.Orders')).toThrow('Invalid capability ID');
  });

  it('rejects hyphens', () => {
    expect(() => capabilityId('market-orders.get')).toThrow('Invalid capability ID');
  });

  it('rejects empty string', () => {
    expect(() => capabilityId('')).toThrow('Invalid capability ID');
  });

  it('rejects leading digit in segment', () => {
    expect(() => capabilityId('1market.orders')).toThrow('Invalid capability ID');
  });
});

describe('capabilityVersion', () => {
  it('accepts positive integers', () => {
    expect(capabilityVersion(1) as number).toBe(1);
    expect(capabilityVersion(42) as number).toBe(42);
  });

  it('rejects zero', () => {
    expect(() => capabilityVersion(0)).toThrow('Invalid capability version');
  });

  it('rejects negative numbers', () => {
    expect(() => capabilityVersion(-1)).toThrow('Invalid capability version');
  });

  it('rejects non-integers', () => {
    expect(() => capabilityVersion(1.5)).toThrow('Invalid capability version');
  });
});

describe('capabilityIdSchema', () => {
  it('validates correct IDs', () => {
    expect(capabilityIdSchema.safeParse('market.orders').success).toBe(true);
  });

  it('rejects invalid IDs', () => {
    expect(capabilityIdSchema.safeParse('INVALID').success).toBe(false);
  });
});

describe('capabilityVersionSchema', () => {
  it('validates positive integers', () => {
    expect(capabilityVersionSchema.safeParse(1).success).toBe(true);
  });

  it('rejects zero', () => {
    expect(capabilityVersionSchema.safeParse(0).success).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(capabilityVersionSchema.safeParse(1.5).success).toBe(false);
  });
});
