import { describe, it, expect } from 'vitest';
import {
  capabilityId,
  capabilityVersion,
  capabilityIdSchema,
  capabilityVersionSchema,
  compareVersions,
  isCompatibleUpgrade,
  isBreakingUpgrade,
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
  it('accepts positive integers and converts to semver', () => {
    expect(capabilityVersion(1) as string).toBe('1.0.0');
    expect(capabilityVersion(42) as string).toBe('42.0.0');
  });

  it('accepts semver strings', () => {
    expect(capabilityVersion('1.0.0') as string).toBe('1.0.0');
    expect(capabilityVersion('2.1.3') as string).toBe('2.1.3');
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

  it('rejects invalid semver strings', () => {
    expect(() => capabilityVersion('1.0')).toThrow('Invalid capability version');
    expect(() => capabilityVersion('abc')).toThrow('Invalid capability version');
  });
});

describe('compareVersions', () => {
  it('compares major versions', () => {
    expect(compareVersions(capabilityVersion('1.0.0'), capabilityVersion('2.0.0'))).toBeLessThan(0);
    expect(compareVersions(capabilityVersion('2.0.0'), capabilityVersion('1.0.0'))).toBeGreaterThan(
      0,
    );
  });

  it('compares minor versions', () => {
    expect(compareVersions(capabilityVersion('1.0.0'), capabilityVersion('1.1.0'))).toBeLessThan(0);
  });

  it('compares patch versions', () => {
    expect(compareVersions(capabilityVersion('1.0.0'), capabilityVersion('1.0.1'))).toBeLessThan(0);
  });

  it('returns 0 for equal versions', () => {
    expect(compareVersions(capabilityVersion('1.2.3'), capabilityVersion('1.2.3'))).toBe(0);
  });
});

describe('isCompatibleUpgrade', () => {
  it('returns true for same-major upgrades', () => {
    expect(isCompatibleUpgrade(capabilityVersion('1.0.0'), capabilityVersion('1.1.0'))).toBe(true);
    expect(isCompatibleUpgrade(capabilityVersion('1.0.0'), capabilityVersion('1.0.1'))).toBe(true);
  });

  it('returns false for cross-major upgrades', () => {
    expect(isCompatibleUpgrade(capabilityVersion('1.0.0'), capabilityVersion('2.0.0'))).toBe(false);
  });

  it('returns false for downgrades', () => {
    expect(isCompatibleUpgrade(capabilityVersion('1.1.0'), capabilityVersion('1.0.0'))).toBe(false);
  });
});

describe('isBreakingUpgrade', () => {
  it('returns true for major version bump', () => {
    expect(isBreakingUpgrade(capabilityVersion('1.0.0'), capabilityVersion('2.0.0'))).toBe(true);
  });

  it('returns false for minor/patch bump', () => {
    expect(isBreakingUpgrade(capabilityVersion('1.0.0'), capabilityVersion('1.1.0'))).toBe(false);
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
  it('validates semver strings', () => {
    expect(capabilityVersionSchema.safeParse('1.0.0').success).toBe(true);
  });

  it('coerces positive integers to semver', () => {
    const result = capabilityVersionSchema.safeParse(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('1.0.0');
    }
  });

  it('rejects zero', () => {
    expect(capabilityVersionSchema.safeParse(0).success).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(capabilityVersionSchema.safeParse(1.5).success).toBe(false);
  });

  it('rejects invalid semver strings', () => {
    expect(capabilityVersionSchema.safeParse('1.0').success).toBe(false);
  });
});
