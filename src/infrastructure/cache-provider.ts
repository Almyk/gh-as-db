export interface CacheEntry<T> {
  data: T;
  sha: string;
}

export interface ICacheProvider {
  get<T>(key: string): CacheEntry<T> | null;
  set<T>(key: string, value: CacheEntry<T>, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
}

interface InternalCacheEntry<T> {
  data: CacheEntry<T>;
  expiry: number | null;
}

export class MemoryCacheProvider implements ICacheProvider {
  private cache = new Map<string, InternalCacheEntry<any>>();

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiry !== null && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, value: CacheEntry<T>, ttl?: number): void {
    const expiry = ttl ? Date.now() + ttl : null;
    this.cache.set(key, { data: value, expiry });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
