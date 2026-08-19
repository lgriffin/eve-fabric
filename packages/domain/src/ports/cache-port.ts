export interface CacheEntry {
  readonly data: unknown;
  readonly storedAt: Date;
  readonly ttlSeconds: number;
}

export interface CachePort {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, data: unknown, ttlSeconds: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
