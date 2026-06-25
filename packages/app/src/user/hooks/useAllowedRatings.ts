import { useCurrentUserId } from "@rezics/contract/api/hooks/useCurrentUserId";
import { userQueries } from "@rezics/contract/api/user/user.queries";
import type { ContentRating } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const BASELINE: ContentRating[] = ["GENERAL", "R_15"];

/**
 * Single source of truth for a caller's allowed ratings.
 *
 * Rule: `{GENERAL, R_15} ∪ settings API content opt-ins` when authenticated;
 * baseline only when not.
 */
export function useAllowedRatings(): {
  allowed: ContentRating[];
  isAuthenticated: boolean;
} {
  const userId = useCurrentUserId();
  const isAuthenticated = Boolean(userId);
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    enabled: isAuthenticated,
  });

  const allowed = useMemo<ContentRating[]>(() => {
    const optedIn =
      (settings?.content?.optedInRatings as ContentRating[] | undefined) ?? [];
    if (!isAuthenticated) return [...BASELINE];
    return [...BASELINE, ...optedIn];
  }, [isAuthenticated, settings?.content?.optedInRatings]);

  return { allowed, isAuthenticated };
}
