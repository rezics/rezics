import {
  SLUG_SCOPES,
  type SlugScopeName,
  type SlugScopesResponse,
} from "@rezics/contract";
import { SlugScope } from "../db/schema";

const cache = new Map<SlugScopeName, string>();

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

/**
 * Look up all five named slug-scope unit ids and cache them in memory.
 * Called once at server startup. Missing scopes are logged and omitted —
 * `/infra/bootstrap` callers SHALL treat the absence of a scope as a seeding
 * failure rather than as an empty namespace.
 * 查找全部五个具名 slug-scope 的 unit id 并缓存到内存中。
 * 在服务器启动时调用一次。缺失的 scope 会被记录并忽略——
 * `/infra/bootstrap` 的调用方应将 scope 的缺失视为播种失败，
 * 而非视为空命名空间。
 */
export async function initSlugScopesCache(): Promise<void> {
  const db = await getServerDb();
  const rows = await db
    .select({ slug: SlugScope.slug, unitId: SlugScope.unitId })
    .from(SlugScope);

  const bySlug = new Map<string, string>(
    rows.map((row) => [row.slug, row.unitId]),
  );

  cache.clear();
  for (const name of SLUG_SCOPES) {
    const id = bySlug.get(name);
    if (id) {
      cache.set(name, id);
    } else {
      console.warn(
        `[infra] slug scope "${name}" not found — POST /slug/resolve and typed by-slug endpoints will reject this scope until it is seeded`,
      );
    }
  }

  console.log(
    `[infra] slug scope IDs cached: ${cache.size}/${SLUG_SCOPES.length}`,
  );
}

/**
 * Return the cached unitId for a named scope, or `null` if unavailable.
 * 返回具名 scope 的缓存 unitId，若不可用则返回 `null`。
 */
export function getSlugScopeId(name: SlugScopeName): string | null {
  return cache.get(name) ?? null;
}

/**
 * Throw-on-miss variant for code paths where the scope must exist.
 * 用于 scope 必须存在的代码路径的「缺失即抛错」变体。
 */
export function requireSlugScopeId(name: SlugScopeName): string {
  const id = cache.get(name);
  if (!id) {
    throw new Error(
      `[infra] slug scope "${name}" is not available — verify that infra seeding has run`,
    );
  }
  return id;
}

/**
 * Derive `Unit.slugScope` for a unit being created.
 *
 * - Type-scope units (USER/REALM/TAG/ZONE/ENTITY) use their own named scope.
 * - `SCOPE` units self-reference and SHALL NOT go through this helper.
 * - Owned units (BOOK/GAME/MEDIA/POST/SHELF/IMAGE/VIDEO/QUOTE/LINK) use the
 *   owner user id when available; otherwise they fall back to the entity
 *   placeholder so the column remains NOT NULL.
 * 为正在创建的 unit 推导 `Unit.slugScope`。
 *
 * - 类型 scope 的 unit（USER/REALM/TAG/ZONE/ENTITY）使用各自的具名 scope。
 * - `SCOPE` unit 自引用，不应经由该辅助函数。
 * - 归属型 unit（BOOK/GAME/MEDIA/POST/SHELF/IMAGE/VIDEO/QUOTE/LINK）在可用时
 *   使用所属用户 id；否则回退到 entity 占位符，以使该列保持 NOT NULL。
 */
export function pickSlugScope(
  type: string,
  ownerUserId?: string | null,
): string {
  switch (type) {
    case "USER":
      return requireSlugScopeId("user");
    case "REALM":
      return requireSlugScopeId("realm");
    case "TAG":
      return requireSlugScopeId("tag");
    case "ZONE":
      return requireSlugScopeId("zone");
    case "ENTITY":
      return requireSlugScopeId("entity");
    default:
      return ownerUserId ?? requireSlugScopeId("entity");
  }
}

/**
 * Snapshot of cached scope ids (omits missing entries).
 * 缓存 scope id 的快照（忽略缺失项）。
 */
export function getSlugScopesSnapshot(): SlugScopesResponse {
  const snapshot: SlugScopesResponse = {};
  for (const [name, id] of cache) {
    snapshot[name] = id;
  }
  return snapshot;
}
