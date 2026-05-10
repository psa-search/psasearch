import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 3600 }) // 1時間TTL

export function getCached<T>(key: string): T | undefined {
  return cache.get<T>(key)
}

export function setCached<T>(key: string, value: T, ttl?: number): void {
  if (ttl !== undefined) {
    cache.set(key, value, ttl)
  } else {
    cache.set(key, value)
  }
}

export function deleteCached(key: string): void {
  cache.del(key)
}
