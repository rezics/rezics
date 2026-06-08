import type {
  InfraBootstrapResponse,
  SeedTagName,
  SlugScopeName,
  SlugScopesResponse,
} from "@rezics/contract";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiFetch } from "../react-query/http";

export const STORAGE_KEY = "rezics:infra:v2";
export const SCHEMA_VERSION = 2;

type InfraCacheShape = {
  schemaVersion: number;
  defaultRealmId?: string;
  seedTags: Partial<Record<SeedTagName, string>>;
  slugScopes: SlugScopesResponse;
  fetchedAt: number;
};

let memoryMirror: InfraCacheShape | null = null;

function readFromStorage(): InfraCacheShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InfraCacheShape;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(value: InfraCacheShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage unavailable
    // localStorage 不可用
  }
}

function loadMemoryMirror(): InfraCacheShape | null {
  if (memoryMirror) return memoryMirror;
  memoryMirror = readFromStorage();
  return memoryMirror;
}

export const infraApi = {
  bootstrap: async (): Promise<InfraBootstrapResponse> => {
    return apiFetch<InfraBootstrapResponse>("/infra/bootstrap");
  },
};

export const infraBootstrapKey = ["infra", "bootstrap"] as const;

export function infraBootstrapQuery() {
  return queryOptions({
    queryKey: infraBootstrapKey,
    queryFn: infraApi.bootstrap,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours — 24 小时
  });
}

/**
 * Synchronous accessor for the default realm ID.
 * 默认 realm ID 的同步访问器。
 * Reads memory mirror first (populated from localStorage on first call).
 * 优先读取内存镜像（首次调用时从 localStorage 填充）。
 */
export function getDefaultRealmId(): string | null {
  return loadMemoryMirror()?.defaultRealmId ?? null;
}

/**
 * Synchronous accessor for a seed tag ID by semantic name.
 * 按语义名同步访问 seed tag ID。
 */
export function getSeedTagId(name: SeedTagName): string | null {
  return loadMemoryMirror()?.seedTags[name] ?? null;
}

/**
 * Synchronous accessor for a named-scope unitId.
 * 按命名作用域同步访问 unitId。
 *
 * Returns `null` until `useInfraBootstrap` has hydrated the cache.
 * 在 `useInfraBootstrap` 完成缓存水合之前返回 `null`。
 */
export function getSlugScopeId(name: SlugScopeName): string | null {
  return loadMemoryMirror()?.slugScopes?.[name] ?? null;
}

/**
 * Hook that fetches `/infra/bootstrap` and persists the result to
 * localStorage. Call once near the root of the app.
 * 获取 `/infra/bootstrap` 并将结果持久化到 localStorage 的 hook。
 * 在应用根部附近调用一次。
 */
export function useInfraBootstrap(): void {
  const { data } = useQuery(infraBootstrapQuery());

  useEffect(() => {
    if (!data) return;
    const next: InfraCacheShape = {
      schemaVersion: SCHEMA_VERSION,
      defaultRealmId: data.defaultRealmId,
      seedTags: data.seedTags,
      slugScopes: data.slugScopes ?? {},
      fetchedAt: Date.now(),
    };
    memoryMirror = next;
    writeToStorage(next);
  }, [data]);
}

/**
 * Clears the infra bootstrap cache (localStorage + in-memory + query cache).
 * 清空 infra bootstrap 缓存（localStorage + 内存 + query 缓存）。
 */
export function useInvalidateInfraCache(): () => void {
  const queryClient = useQueryClient();
  return () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
      // 忽略
    }
    memoryMirror = null;
    queryClient.removeQueries({ queryKey: infraBootstrapKey });
  };
}

export function invalidateInfraCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
    // 忽略
  }
  memoryMirror = null;
}
