import { describe, it, expect } from 'vitest';
import type { Clock } from '@eve-fabric/core';
import { MemoryCache } from '../src/memory-cache.js';

function steppingClock(start: number): Clock & { advance(ms: number): void } {
  let now = start;
  return { now: () => now, advance: (ms) => (now += ms) };
}

describe('MemoryCache with an injected Clock (FAB-DET-01)', () => {
  it('expires an entry exactly when the clock passes its TTL', async () => {
    const clock = steppingClock(1_000_000);
    const cache = new MemoryCache({ clock });
    await cache.set('k', 'v', 10);

    clock.advance(9_999);
    expect(await cache.has('k')).toBe(true);

    clock.advance(1);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('stamps storedAt from the clock', async () => {
    const cache = new MemoryCache({ clock: steppingClock(1_700_000_000_000) });
    await cache.set('k', 'v', 10);
    expect((await cache.get('k'))?.storedAt.getTime()).toBe(1_700_000_000_000);
  });
});
