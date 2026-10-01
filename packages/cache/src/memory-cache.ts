import type { CacheEntry, CachePort, Clock } from '@eve-fabric/core';
import { systemClock } from '@eve-fabric/core';

interface InternalEntry {
  readonly data: unknown;
  readonly storedAt: Date;
  readonly ttlSeconds: number;
  readonly expiresAt: number;
}

export class MemoryCache implements CachePort {
  private readonly store = new Map<string, InternalEntry>();
  private readonly clock: Clock;

  constructor(options?: { readonly clock?: Clock | undefined }) {
    this.clock = options?.clock ?? systemClock;
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (this.clock.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return {
      data: entry.data,
      storedAt: entry.storedAt,
      ttlSeconds: entry.ttlSeconds,
    };
  }

  async set(key: string, data: unknown, ttlSeconds: number): Promise<void> {
    const storedAt = new Date(this.clock.now());
    this.store.set(key, {
      data,
      storedAt,
      ttlSeconds,
      expiresAt: this.clock.now() + ttlSeconds * 1000,
    });
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return false;
    }
    if (this.clock.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /** Returns the number of non-expired entries. */
  get size(): number {
    return this.store.size;
  }
}
