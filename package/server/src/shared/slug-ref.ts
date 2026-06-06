import {
  isNamedSlugScope,
  type SlugRef,
  type SlugScopeName,
  type TagRef,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { Unit } from "../db/schema";
import { getSlugScopeId } from "../infra/slug-scopes";

type SlugRefRepository = {
  findUnitIdBySlug(input: {
    slugScope: string;
    slug: string;
  }): Promise<string | null>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleSlugRefRepository(): SlugRefRepository {
  return {
    async findUnitIdBySlug({ slugScope, slug }) {
      const db = await getServerDb();
      const [row] = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(and(eq(Unit.slugScope, slugScope), eq(Unit.slug, slug)))
        .limit(1);
      return row?.id ?? null;
    },
  };
}

const defaultSlugRefRepository = createDrizzleSlugRefRepository();

/**
 * Resolve a {@link SlugRef.scope} value to the `Unit.slugScope` UUID used in
 * `(slugScope, slug)` lookups. A named scope (`'user' | 'realm' | …`) goes
 * through the cached `SlugScope` map; an owner-unit-id string is used as-is.
 *
 * Returns `null` when a named scope has not been seeded yet.
 */
export function resolveScopeId(scope: string): string | null {
  if (isNamedSlugScope(scope)) {
    return getSlugScopeId(scope as SlugScopeName);
  }
  return scope;
}

/**
 * Resolve a {@link SlugRef} or {@link TagRef} to a unitId.
 *
 * Order of preference:
 *  1. `unitId` if already provided
 *  2. `(slugScope, slug)` lookup using the carried `scope`
 *  3. `null` otherwise
 *
 * `TagRef` instances carry no `scope` field and implicitly resolve against
 * the tag scope.
 */
export async function resolveSlugRef(
  ref: SlugRef | TagRef,
  repository: SlugRefRepository = defaultSlugRefRepository,
): Promise<string | null> {
  if (ref.unitId) return ref.unitId;
  if (!ref.slug) return null;

  const scope = "scope" in ref && ref.scope ? ref.scope : "tag";

  const slugScope = resolveScopeId(scope);
  if (!slugScope) return null;

  return repository.findUnitIdBySlug({ slugScope, slug: ref.slug });
}

/**
 * Resolve an array of refs to unitIds. Filters out refs that cannot be
 * resolved.
 */
export async function resolveSlugRefs(
  refs: (SlugRef | TagRef)[],
  repository: SlugRefRepository = defaultSlugRefRepository,
): Promise<string[]> {
  const results = await Promise.all(
    refs.map((ref) => resolveSlugRef(ref, repository)),
  );
  return results.filter((id): id is string => id !== null);
}
