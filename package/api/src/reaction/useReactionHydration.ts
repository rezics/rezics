/**
 * useReactionHydration — side-effect hook that primes the React Query cache
 * with the summary + (when authenticated) my-reaction batches for a given set
 * of target IDs.
 *
 * Returns only loading/hydration flags. Reaction data is read elsewhere via
 * `useReactionData(unitId)`.
 */

import { selectHasAuthIdentity } from "../states/authSessionModel";
import { useAuthSessionStore } from "../states/authSessionStore";
import {
  useBatchReactionSummary,
  useBatchUserReactions,
} from "./reaction.queries";

export type UseReactionHydrationOptions = {
  /** Override the default auth-derived enabled state for the my-reaction batch. */
  authenticated?: boolean;
};

export type UseReactionHydrationReturn = {
  isHydrated: boolean;
  isLoading: boolean;
};

export function useReactionHydration(
  targetIds: readonly string[],
  options?: UseReactionHydrationOptions,
): UseReactionHydrationReturn {
  const isAuthenticatedFromStore = useAuthSessionStore(selectHasAuthIdentity);
  const isAuthenticated = options?.authenticated ?? isAuthenticatedFromStore;

  const summaryQuery = useBatchReactionSummary(targetIds);
  const myQuery = useBatchUserReactions(targetIds, {
    enabled: isAuthenticated,
  });

  const hasIds = targetIds.length > 0;

  const summaryReady = !hasIds || summaryQuery.isSuccess;
  const myReady = !hasIds || !isAuthenticated || myQuery.isSuccess;

  return {
    isHydrated: summaryReady && myReady,
    isLoading: summaryQuery.isLoading || (isAuthenticated && myQuery.isLoading),
  };
}
