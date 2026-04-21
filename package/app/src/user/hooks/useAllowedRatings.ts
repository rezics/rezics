import { userQueries } from "@rezics/api/user/user.queries";
import type { ContentRating } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useUserProfileStore } from "@/user/states";

const BASELINE: ContentRating[] = ["GENERAL", "R_15"];

/**
 * Single source of truth for a caller's allowed ratings.
 *
 * Rule: `{GENERAL, R_15} ∪ user.settings.content.optedInRatings` when
 * authenticated; baseline only when not.
 */
export function useAllowedRatings(): {
  allowed: ContentRating[];
  isAuthenticated: boolean;
} {
  const { user } = useUserProfileStore();
  const isAuthenticated = user !== null;
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
