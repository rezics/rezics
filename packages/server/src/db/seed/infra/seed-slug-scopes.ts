import { SLUG_SCOPES, type SlugScopeName } from "@rezics/contract";
import { eq, sql } from "drizzle-orm";
import type { ServerDb } from "../../client";
import { SlugScope, Unit } from "../../schema";

export type SlugScopesMap = Record<SlugScopeName, string>;
type SlugScopeSeedDb = Pick<ServerDb, "select" | "transaction">;

/**
 * Seed the five named slug-scope placeholder Units and their `SlugScope`
 * lookup rows.
 *
 * Each scope row maps a named-scope key (`user`, `realm`, `tag`, `zone`,
 * `entity`) to a placeholder `Unit { type: SCOPE, slug: null }` whose id is
 * the `Unit.slugScope` value used by every top-level slug under that scope.
 * SCOPE units self-reference: `slugScope = self.id`.
 *
 * Idempotent: if a `SlugScope` row already exists for a name, the existing
 * unit id is returned. Returns a map of every scope name to its unit id.
 * Runs before any other slug-bearing seed.
 */
export async function seedSlugScopes(
  db: SlugScopeSeedDb,
): Promise<SlugScopesMap> {
  console.log("[Seed] Seeding slug scopes...");

  const map = {} as SlugScopesMap;

  for (const name of SLUG_SCOPES) {
    const [existing] = await db
      .select({ unitId: SlugScope.unitId })
      .from(SlugScope)
      .where(eq(SlugScope.slug, name))
      .limit(1);

    if (existing) {
      map[name] = existing.unitId;
      console.log(
        `[Seed]   Slug scope "${name}" already exists (${existing.unitId}), skipping.`,
      );
      continue;
    }

    const unitId = await db.transaction(async (tx) => {
      const result = await tx.execute(sql`SELECT uuidv7() as id`);
      const id = (result.rows as Array<{ id?: string }>)[0]?.id;
      if (!id) {
        throw new Error(
          `[Seed] uuidv7() returned no row when creating slug scope "${name}"`,
        );
      }

      await tx.insert(Unit).values({
        id,
        type: "SCOPE",
        slug: null,
        slugScope: id,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        updatedAt: new Date(),
      });

      await tx.insert(SlugScope).values({ slug: name, unitId: id });

      return id;
    });

    map[name] = unitId;
    console.log(`[Seed]   Created slug scope "${name}" (${unitId})`);
  }

  return map;
}
