import { useQuery } from "@tanstack/react-query";
import { echoKvGetQuery } from "../echokv/echokv";
import { parseEchoKVResponse } from "../echokv/util";

const STORAGE_KEY = "rezics:infra:default_realm_id";

/**
 * Synchronous accessor for the default realm ID.
 * Reads from localStorage first, falls back to null.
 */
export function getDefaultRealmId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistDefaultRealmId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable (e.g. private browsing)
  }
}

/**
 * Hook that fetches the default realm ID from EchoKV and persists it
 * to localStorage. Call once during app initialization.
 */
export function useInfraBootstrap(): void {
  const { data } = useQuery(echoKvGetQuery("infra:default_realm"));

  if (data) {
    const parsed = parseEchoKVResponse<{ id: string }>(data);
    if (parsed?.id) {
      persistDefaultRealmId(parsed.id);
    }
  }
}
