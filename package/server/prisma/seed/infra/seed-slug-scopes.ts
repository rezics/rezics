import { SLUG_SCOPES, type SlugScopeName } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client";

export type SlugScopesMap = Record<SlugScopeName, string>;

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
  prisma: PrismaClient,
): Promise<SlugScopesMap> {
  console.log("[Seed] Seeding slug scopes...");

  const map = {} as SlugScopesMap;

  for (const name of SLUG_SCOPES) {
    const existing = await prisma.slugScope.findUnique({
      where: { slug: name },
      select: { unitId: true },
    });

    if (existing) {
      map[name] = existing.unitId;
      console.log(
        `[Seed]   Slug scope "${name}" already exists (${existing.unitId}), skipping.`,
      );
      continue;
    }

    const unitId = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7() as id`;
      const id = rows[0]?.id;
      if (!id) {
        throw new Error(
          `[Seed] uuidv7() returned no row when creating slug scope "${name}"`,
        );
      }

      await tx.unit.create({
        data: {
          id,
          type: "SCOPE",
          slug: null,
          slugScope: id,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isLanguageNeutral: true,
        },
      });

      await tx.slugScope.create({
        data: { slug: name, unitId: id },
      });

      return id;
    });

    map[name] = unitId;
    console.log(`[Seed]   Created slug scope "${name}" (${unitId})`);
  }

  return map;
}
