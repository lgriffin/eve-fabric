import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryCache } from '../src/memory-cache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  describe('set and get', () => {
    it('stores and retrieves a value', async () => {
      await cache.set('key1', { value: 42 }, 60);
      const entry = await cache.get('key1');
      expect(entry).toBeDefined();
      expect(entry!.data).toEqual({ value: 42 });
    });

    it('returns undefined for missing keys', async () => {
      const entry = await cache.get('nonexistent');
      expect(entry).toBeUndefined();
    });

    it('stores ttlSeconds in the entry', async () => {
      await cache.set('key1', 'data', 120);
      const entry = await cache.get('key1');
      expect(entry).toBeDefined();
      expect(entry!.ttlSeconds).toBe(120);
    });

    it('stores storedAt as a Date', async () => {
      await cache.set('key1', 'data', 60);
      const entry = await cache.get('key1');
      expect(entry).toBeDefined();
      expect(entry!.storedAt).toBeInstanceOf(Date);
    });

    it('overwrites existing values', async () => {
      await cache.set('key1', 'first', 60);
      await cache.set('key1', 'second', 60);
      const entry = await cache.get('key1');
      expect(entry!.data).toBe('second');
    });
  });

  describe('has', () => {
    it('returns true for existing keys', async () => {
      await cache.set('key1', 'data', 60);
      expect(await cache.has('key1')).toBe(true);
    });

    it('returns false for missing keys', async () => {
      expect(await cache.has('nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes an existing entry', async () => {
      await cache.set('key1', 'data', 60);
      await cache.delete('key1');
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('does not throw when deleting a nonexistent key', async () => {
      await expect(cache.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('clear', () => {
    it('removes all entries', async () => {
      await cache.set('key1', 'a', 60);
      await cache.set('key2', 'b', 60);
      await cache.set('key3', 'c', 60);
      await cache.clear();
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    it('returns undefined for expired entries on get', async () => {
      vi.useFakeTimers();
      try {
        await cache.set('key1', 'data', 1); // 1 second TTL
        vi.advanceTimersByTime(1500); // advance past TTL
        const entry = await cache.get('key1');
        expect(entry).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns false for expired entries on has', async () => {
      vi.useFakeTimers();
      try {
        await cache.set('key1', 'data', 2); // 2 second TTL
        vi.advanceTimersByTime(2500);
        expect(await cache.has('key1')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns entry before TTL expires', async () => {
      vi.useFakeTimers();
      try {
        await cache.set('key1', 'data', 10); // 10 second TTL
        vi.advanceTimersByTime(5000); // only 5 seconds
        const entry = await cache.get('key1');
        expect(entry).toBeDefined();
        expect(entry!.data).toBe('data');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('size', () => {
    it('reports the number of entries', async () => {
      expect(cache.size).toBe(0);
      await cache.set('a', 1, 60);
      expect(cache.size).toBe(1);
      await cache.set('b', 2, 60);
      expect(cache.size).toBe(2);
    });
  });
});
