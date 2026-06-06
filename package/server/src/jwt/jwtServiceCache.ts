import type { CachedJwtService } from "./jwtServiceRepository";
import { fetchJwtService } from "./jwtServiceRepository";

const TTL_MS = 2 * 60 * 1000; // 2 minutes

type CacheEntry = {
  entry: CachedJwtService;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export async function getJwtService(
  serviceKey: string,
): Promise<CachedJwtService> {
  const now = Date.now();
  const cached = cache.get(serviceKey);

  if (cached && cached.expiresAt > now) {
    return cached.entry;
  }

  const entry = await fetchJwtService(serviceKey);
  cache.set(serviceKey, { entry, expiresAt: now + TTL_MS });
  return entry;
}

export function invalidateJwtService(serviceKey: string): void {
  cache.delete(serviceKey);
}
