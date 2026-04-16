import type { SlugRef } from "@rezics/contract";
import { prisma } from "#/prisma/client";

/**
 * Resolve a SlugRef to a unitId.
 * Uses unitId directly if present, otherwise looks up by slug.
 */
export async function resolveSlugRef(
  ref: SlugRef,
): Promise<string | null> {
  if (ref.unitId) return ref.unitId;

  const unit = await prisma.unit.findUnique({
    where: { slug: ref.slug },
    select: { id: true },
  });

  return unit?.id ?? null;
}

/**
 * Resolve an array of SlugRefs to unitIds.
 * Filters out refs that cannot be resolved (non-existent slugs).
 */
export async function resolveSlugRefs(
  refs: SlugRef[],
): Promise<string[]> {
  const results = await Promise.all(refs.map(resolveSlugRef));
  return results.filter((id): id is string => id !== null);
}
