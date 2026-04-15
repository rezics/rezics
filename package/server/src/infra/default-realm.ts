import { prisma } from "#/prisma/client";

let cachedDefaultRealmId: string | null = null;

/**
 * Read the default realm ID from EchoKV and cache it in memory.
 * Called once at server startup. Logs a warning if the key is missing.
 */
export async function initDefaultRealmCache(): Promise<void> {
  const row = await prisma.echoKV.findUnique({
    where: { key: "infra:default_realm" },
  });

  if (!row?.value || typeof row.value !== "object") {
    console.warn(
      "[infra] default realm ID not found in EchoKV — auto-join will be skipped",
    );
    return;
  }

  const value = row.value as Record<string, unknown>;
  if (typeof value.id === "string") {
    cachedDefaultRealmId = value.id;
    console.log(`[infra] default realm ID cached: ${cachedDefaultRealmId}`);
  } else {
    console.warn(
      "[infra] infra:default_realm exists but has no valid id field",
    );
  }
}

/** Return the cached default realm ID, or `null` if not available. */
export function getDefaultRealmId(): string | null {
  return cachedDefaultRealmId;
}
