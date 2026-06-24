import type {
  SubscriberCountResponse,
  SubscriptionCheckResponse,
  SubscriptionCreateBody,
  SubscriptionDTO,
  SubscriptionListResponse,
  SubscriptionPatchBody,
  UserSubscriptionListEntryBatchReorderBody,
  UserSubscriptionListEntryDTO,
  UserSubscriptionListEntryListQuery,
  UserSubscriptionListEntryListResponse,
  UserSubscriptionListEntryPinBody,
  UserSubscriptionListEntryReorderBody,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

/**
 * Thin client over the `/subscription/*` endpoints exposed by
 * the backend API. Responsible for the wire shape only — TanStack
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
    subscribedUnitId: string,
  ): Promise<{ unsubscribed: boolean }> => {
    return apiFetch<{ unsubscribed: boolean }>(
      `/subscription/${subscribedUnitId}`,
      { method: "DELETE" },
    );
  },

  updateChannels: async (
    subscribedUnitId: string,
    input: SubscriptionPatchBody,
  ): Promise<SubscriptionDTO> => {
    return apiFetch<SubscriptionDTO>(`/subscription/${subscribedUnitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  listMine: async (query?: {
    subscribedType?: string;
  }): Promise<SubscriptionListResponse> => {
    return apiFetch<SubscriptionListResponse>(
      `/subscription/me${buildQueryString(query)}`,
    );
  },

  check: async (
    subscribedUnitId: string,
  ): Promise<SubscriptionCheckResponse> => {
    return apiFetch<SubscriptionCheckResponse>(
      `/subscription/check/${subscribedUnitId}`,
    );
  },

  count: async (subscribedUnitId: string): Promise<SubscriberCountResponse> => {
    return apiFetch<SubscriberCountResponse>(
      `/subscription/count/${subscribedUnitId}`,
    );
  },

  listEntries: async (
    query?: UserSubscriptionListEntryListQuery,
  ): Promise<UserSubscriptionListEntryListResponse> => {
    return apiFetch<UserSubscriptionListEntryListResponse>(
      `/subscription/entries${buildQueryString(query)}`,
    );
  },

  pinEntry: async (
    subscribedUnitId: string,
    input: UserSubscriptionListEntryPinBody,
  ): Promise<UserSubscriptionListEntryDTO> => {
    return apiFetch<UserSubscriptionListEntryDTO>(
      `/subscription/entries/${subscribedUnitId}/pin`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  reorderEntry: async (
    subscribedUnitId: string,
    input: UserSubscriptionListEntryReorderBody,
  ): Promise<UserSubscriptionListEntryDTO> => {
    return apiFetch<UserSubscriptionListEntryDTO>(
      `/subscription/entries/${subscribedUnitId}/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  reorderEntries: async (
    input: UserSubscriptionListEntryBatchReorderBody,
  ): Promise<UserSubscriptionListEntryDTO[]> => {
    return apiFetch<UserSubscriptionListEntryDTO[]>(
      "/subscription/entries/reorder",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  removeEntry: async (
    subscribedUnitId: string,
  ): Promise<{ removed: boolean }> => {
    return apiFetch<{ removed: boolean }>(
      `/subscription/entries/${subscribedUnitId}`,
      { method: "DELETE" },
    );
  },

  recoverEntry: async (
    subscribedUnitId: string,
  ): Promise<UserSubscriptionListEntryDTO> => {
    return apiFetch<UserSubscriptionListEntryDTO>(
      `/subscription/entries/${subscribedUnitId}/recover`,
      { method: "POST" },
    );
  },
};
