import { DEFAULT_REALM } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { getSlugScopeId } from "./slug-scopes";

let cachedDefaultRealmId: string | null = null;

/**
 * Look up the default realm by `(realmScope, slug)` and cache its ID in
 * memory. Called once at server startup, after `initSlugScopesCache`.
 */
export async function initDefaultRealmCache(): Promise<void> {
  const realmScope = getSlugScopeId("realm");
  if (!realmScope) {
    console.warn(
      `[infra] realm slug scope not seeded — default realm cache cannot be hydrated`,
    );
    return;
  }

  const unit = await prisma.unit.findUnique({
    where: {
      slugScope_slug: { slugScope: realmScope, slug: DEFAULT_REALM.slug },
    },
    select: { id: true, type: true },
  });

  if (!unit) {
    console.warn(
      `[infra] default realm slug "${DEFAULT_REALM.slug}" not found — auto-join will be skipped`,
    );
    return;
  }

  if (unit.type !== "REALM") {
    console.warn(
      `[infra] slug "${DEFAULT_REALM.slug}" resolved to non-REALM unit (type=${unit.type}) — ignoring`,
    );
    return;
  }

  cachedDefaultRealmId = unit.id;
  console.log(`[infra] default realm ID cached: ${cachedDefaultRealmId}`);
}

/** Return the cached default realm ID, or `null` if not available. */
export function getDefaultRealmId(): string | null {
  return cachedDefaultRealmId;
}
