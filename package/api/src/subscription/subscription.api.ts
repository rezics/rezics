import type {
  SubscriberCountResponse,
  SubscriptionCheckResponse,
  SubscriptionCreateBody,
  SubscriptionDTO,
  SubscriptionListResponse,
  SubscriptionPatchBody,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

/**
 * Thin client over the `/subscription/*` endpoints exposed by
 * `@rezics/server`. Responsible for the wire shape only — TanStack
 * Query integration lives in `subscription.queries.ts` and
 * `subscription.mutations.ts`.
 */
export const subscriptionApi = {
  subscribe: async (
    input: SubscriptionCreateBody,
  ): Promise<SubscriptionDTO> => {
    return apiFetch<SubscriptionDTO>("/subscription", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  unsubscribe: async (
    targetUnitId: string,
  ): Promise<{ unsubscribed: boolean }> => {
    return apiFetch<{ unsubscribed: boolean }>(
      `/subscription/${targetUnitId}`,
      { method: "DELETE" },
    );
  },

  updateChannels: async (
    targetUnitId: string,
    input: SubscriptionPatchBody,
  ): Promise<SubscriptionDTO> => {
    return apiFetch<SubscriptionDTO>(`/subscription/${targetUnitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  listMine: async (query?: {
    targetType?: string;
  }): Promise<SubscriptionListResponse> => {
    return apiFetch<SubscriptionListResponse>(
      `/subscription/me${buildQueryString(query)}`,
    );
  },

  check: async (targetUnitId: string): Promise<SubscriptionCheckResponse> => {
    return apiFetch<SubscriptionCheckResponse>(
      `/subscription/check/${targetUnitId}`,
    );
  },

  count: async (targetUnitId: string): Promise<SubscriberCountResponse> => {
    return apiFetch<SubscriberCountResponse>(
      `/subscription/count/${targetUnitId}`,
    );
  },
};
