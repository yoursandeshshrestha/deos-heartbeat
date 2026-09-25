import type { FleetPayload } from './types.js'

type CacheEntry = {
  payload: FleetPayload
  storedAt: number
}

const CACHE_TTL_MS = 30_000
let cache: CacheEntry | null = null

export function getFleetCache(): { payload: FleetPayload; ageMs: number } | null {
  if (!cache) return null
  return { payload: cache.payload, ageMs: Date.now() - cache.storedAt }
}

export function setFleetCache(payload: FleetPayload) {
  cache = { payload, storedAt: Date.now() }
}

export function isFleetCacheFresh(ageMs: number) {
  return ageMs < CACHE_TTL_MS
}
