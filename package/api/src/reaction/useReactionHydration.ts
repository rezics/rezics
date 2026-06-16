/**
 * useReactionHydration — side-effect hook that primes the React Query cache
 * with the summary + (when authenticated) my-reaction batches for a given set
 * of target IDs.
 *
 * Returns only loading/hydration flags. Reaction data is read elsewhere via
 * `useReactionData(unitId)`.
 *
 * useReactionHydration —— 副作用 hook，为给定的一组 target ID 预热 React Query
 * 缓存，写入 summary 批次以及（已认证时）my-reaction 批次。
 *
 * 仅返回 loading/hydration 标志。Reaction 数据在别处通过
 * `useReactionData(unitId)` 读取。
 */

import { selectHasAuthIdentity } from "../states/authSessionModel";
import { useAuthSessionStore } from "../states/authSessionStore";
import {
  useBatchReactionSummary,
  useBatchShareSummary,
  useBatchUserReactions,
} from "./reaction.queries";

export type UseReactionHydrationOptions = {
  /** Override the default auth-derived enabled state for the my-reaction batch. 覆盖 my-reaction 批次默认由认证状态推导的 enabled 值。 */
  authenticated?: boolean;
  summaryScopeKey?: string | null;
  userScopeKey?: string | null;
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

  const summaryQuery = useBatchReactionSummary(targetIds, {
    scopeKey: options?.summaryScopeKey,
  });
  const shareSummaryQuery = useBatchShareSummary(targetIds);
  const myQuery = useBatchUserReactions(targetIds, {
    enabled: isAuthenticated,
    scopeKey: options?.userScopeKey,
  });

  const hasIds = targetIds.length > 0;

  const summaryReady = !hasIds || summaryQuery.isSuccess;
  const shareSummaryReady = !hasIds || shareSummaryQuery.isSuccess;
  const myReady = !hasIds || !isAuthenticated || myQuery.isSuccess;

  return {
    isHydrated: summaryReady && shareSummaryReady && myReady,
    isLoading:
      summaryQuery.isLoading ||
      shareSummaryQuery.isLoading ||
      (isAuthenticated && myQuery.isLoading),
  };
}
