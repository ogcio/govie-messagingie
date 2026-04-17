import type { KVCache } from "./types"

type KVCacheEntry<T> = {
  value: T
  expiresAt: number
}

function isValidKVCacheValue(v: unknown): v is KVCacheEntry<unknown> {
  const o = v as KVCacheEntry<unknown>
  return o?.value !== undefined && !Number.isNaN(o?.expiresAt)
}

export function buildMemoryKVCache(): KVCache {
  const kvcache = new Map<string, KVCacheEntry<unknown>>()

  return {
    async destroy(key) {
      kvcache.delete(key)
    },
    async get<T>(key: string, validator?: (v: unknown) => v is T) {
      const cacheItem = kvcache.get(key)
      if (!isValidKVCacheValue(cacheItem)) {
        kvcache.delete(key)
        return null
      }

      const { expiresAt, value } = cacheItem

      if (Date.now() > expiresAt) {
        kvcache.delete(key)
        return null
      }

      if (validator) {
        if (validator(value)) {
          return value
        }
        kvcache.delete(key)
        return null
      }

      return (value as T) ?? null
    },
    async set(key, item, expiresInSeconds) {
      kvcache.set(key, {
        expiresAt: Date.now() + expiresInSeconds * 1000,
        value: item,
      })
    },
  }
}

const cache: KVCache = buildMemoryKVCache()
export default cache
