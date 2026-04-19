import type { InfraBootstrapResponse, SeedTagName } from "@rezics/contract";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiFetch } from "../react-query/http";

export const STORAGE_KEY = "rezics:infra:v1";
export const SCHEMA_VERSION = 1;

type InfraCacheShape = {
  schemaVersion: number;
  defaultRealmId?: string;
  seedTags: Partial<Record<SeedTagName, string>>;
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
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });
}

/**
 * Synchronous accessor for the default realm ID.
 * Reads memory mirror first (populated from localStorage on first call).
 */
export function getDefaultRealmId(): string | null {
  return loadMemoryMirror()?.defaultRealmId ?? null;
}

/**
 * Synchronous accessor for a seed tag ID by semantic name.
 */
export function getSeedTagId(name: SeedTagName): string | null {
  return loadMemoryMirror()?.seedTags[name] ?? null;
}

/**
 * Hook that fetches `/infra/bootstrap` and persists the result to
 * localStorage. Call once near the root of the app.
 */
export function useInfraBootstrap(): void {
  const { data } = useQuery(infraBootstrapQuery());

  useEffect(() => {
    if (!data) return;
    const next: InfraCacheShape = {
      schemaVersion: SCHEMA_VERSION,
      defaultRealmId: data.defaultRealmId,
      seedTags: data.seedTags,
      fetchedAt: Date.now(),
    };
    memoryMirror = next;
    writeToStorage(next);
  }, [data]);
}

/**
 * Clears the infra bootstrap cache (localStorage + in-memory + query cache).
 */
export function useInvalidateInfraCache(): () => void {
  const queryClient = useQueryClient();
  return () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
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
  }
  memoryMirror = null;
}
