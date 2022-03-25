import LRU, { Options } from "lru-cache";
import { Language } from "./backend";

export interface CacheKey {
  namespace: string;
  locale: string;
}

export interface Cache {
  get(key: CacheKey): Promise<Language | null>;
  set(key: CacheKey, value: Language): Promise<void>;
  has(key: CacheKey): Promise<boolean>;
}

export class InMemoryLRUCache implements Cache {
  private cache: LRU<string, Language>;

  constructor(options: Partial<Options<string, Language>> = {}) {
    this.cache = new LRU<string, Language>({ max: 100, ...options });
  }

  async set(key: CacheKey, value: Language): Promise<void> {
    this.cache.set(this.serialize(key), value);
  }

  async get(key: CacheKey): Promise<Language | null> {
    return this.cache.get(this.serialize(key)) ?? null;
  }

  async has(key: CacheKey): Promise<boolean> {
    return this.cache.has(this.serialize(key));
  }

  private serialize(cacheKey: CacheKey) {
    return `${cacheKey.locale}/${cacheKey.namespace}`;
  }
}
