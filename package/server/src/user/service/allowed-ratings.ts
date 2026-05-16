import type { UserSettings } from "@rezics/contract";
import { BASELINE_RATINGS, OPT_IN_RATINGS } from "@rezics/contract";
import type { ContentRating } from "#/prisma/client";
import { prisma } from "#/prisma/client";

/**
 * Allowed rating set for a caller:
 *   {GENERAL, R_15} ∪ (authenticated ? user.settings.content.optedInRatings : [])
 *
 * Unauthenticated callers pass `userId = null`. Invalid / unknown users fall
 * back to the baseline as well.
 */
export async function deriveAllowedRatings(
  userId: string | null | undefined,
): Promise<ContentRating[]> {
  const base = [...BASELINE_RATINGS] as ContentRating[];
  if (!userId) return base;

  const user = await prisma.user
    .findUnique({ where: { unitId: userId }, select: { settings: true } })
    .catch(() => null);

  const settings = (user?.settings as UserSettings | null) ?? null;
  const optedIn = settings?.content?.optedInRatings ?? [];
  const filtered = optedIn.filter((r): r is "R_18" | "R_18G" =>
    OPT_IN_RATINGS.includes(r as ContentRating),
  );
  return [...base, ...(filtered as ContentRating[])];
}

/**
 * Intersect a requested ratings set with the caller's allowed set. Requested
 * ratings outside the allowed set are dropped silently. If the requester did
 * not specify any (undefined), the full allowed set is returned.
 */
export function intersectRatings(
  allowed: ContentRating[],
  requested: ContentRating[] | undefined,
): ContentRating[] {
  if (!requested || requested.length === 0) return allowed;
  const allowedSet = new Set(allowed);
  return requested.filter((r) => allowedSet.has(r));
}
