import { describe, it, expect } from 'vitest';
import { fixedClock, systemClock } from '../src/ports/clock.js';

describe('Clock port', () => {
  it('fixedClock reads the same instant every time', () => {
    const clock = fixedClock(new Date('2026-10-01T00:00:00Z'));
    expect(clock.now()).toBe(Date.parse('2026-10-01T00:00:00Z'));
    expect(clock.now()).toBe(clock.now());
  });

  it('fixedClock accepts epoch milliseconds', () => {
    expect(fixedClock(42).now()).toBe(42);
  });

  it('systemClock reads the wall clock', () => {
    const before = Date.now();
    const now = systemClock.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
