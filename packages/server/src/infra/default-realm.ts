import { DEFAULT_REALM } from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { Unit } from "../db/schema";
import { getSlugScopeId } from "./slug-scopes";

let cachedDefaultRealmId: string | null = null;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

/**
 * Look up the default realm by `(realmScope, slug)` and cache its ID in
 * memory. Called once at server startup, after `initSlugScopesCache`.
 * 通过 `(realmScope, slug)` 查找默认 realm 并将其 ID 缓存在内存中。
 * 在服务器启动时、`initSlugScopesCache` 之后调用一次。
 */
export async function initDefaultRealmCache(): Promise<void> {
  const realmScope = getSlugScopeId("realm");
  if (!realmScope) {
    console.warn(
      `[infra] realm slug scope not seeded — default realm cache cannot be hydrated`,
    );
    return;
  }

  const db = await getServerDb();
  const [unit] = await db
    .select({ id: Unit.id, type: Unit.type })
    .from(Unit)
    .where(
      and(eq(Unit.slugScope, realmScope), eq(Unit.slug, DEFAULT_REALM.slug)),
    )
    .limit(1);

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

/** Return the cached default realm ID, or `null` if not available. 返回缓存的默认 realm ID，若不可用则返回 `null`。 */
export function getDefaultRealmId(): string | null {
  return cachedDefaultRealmId;
}
