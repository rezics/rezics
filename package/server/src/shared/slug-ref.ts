import type { SlugRef, TagRef } from "@rezics/contract";
import { prisma } from "#/prisma/client";

/**
 * Resolve a SlugRef (or TagRef) to a unitId.
 * Uses unitId directly when present; otherwise looks up by slug.
 * Returns null when neither resolves.
 */
export async function resolveSlugRef(
  ref: SlugRef | TagRef,
): Promise<string | null> {
  if (ref.unitId) return ref.unitId;
  if (!ref.slug) return null;

  const unit = await prisma.unit.findUnique({
    where: { slug: ref.slug },
    select: { id: true },
  });

  return unit?.id ?? null;
}

/**
 * Resolve an array of refs to unitIds.
 * Filters out refs that cannot be resolved.
 */
export async function resolveSlugRefs(
  refs: (SlugRef | TagRef)[],
): Promise<string[]> {
  const results = await Promise.all(refs.map(resolveSlugRef));
  return results.filter((id): id is string => id !== null);
}
