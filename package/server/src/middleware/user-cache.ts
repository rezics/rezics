// TODO performance issue, cache size may be too large

import type { UserDTO } from "@rezics/contract";

interface CacheEntry {
  user: UserDTO;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 300;

const cache = new Map<string, CacheEntry>();

let ttlSeconds = DEFAULT_TTL_SECONDS;

export function setUserCacheTtl(seconds: number) {
  ttlSeconds = seconds;
}

export function getOrFetchUser(unitId: string): UserDTO | null {
  const entry = cache.get(unitId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(unitId);
    return null;
  }
  return entry.user;
}

export function cacheUser(unitId: string, user: UserDTO) {
  cache.set(unitId, {
    user,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidate(unitId: string) {
  cache.delete(unitId);
}
