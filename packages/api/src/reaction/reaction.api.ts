/**
 * Reaction API client functions
 * Reads go directly to the reaction service; writes are routed through the main server.
 */

import { getApiConfig } from "../config";
import { apiFetch } from "../react-query/http";
import type {
  ReactionCreateInput,
  ReactionDeleteQuery,
  ReactionDTO,
  ReactionHistoryGivenItem,
  ReactionHistoryPage,
  ReactionHistoryQuery,
  ReactionHistoryReceivedItem,
  ReactionMyResponse,
  ReactionSummaryResponse,
  ShareCreateInput,
  ShareCreateResponse,
  ShareSummaryResponse,
} from "./reaction.types";

type ReactionContextQuery = {
  contextUnitId?: string | null;
};

function appendContextQuery(
  qs: URLSearchParams,
  contextUnitId: string | null | undefined,
) {
  if (contextUnitId === undefined) return;
  qs.set("contextUnitId", contextUnitId ?? "");
}

function getReactionBaseUrl(): string {
  return getApiConfig().reactionServiceUrl;
}

async function reactionFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${getReactionBaseUrl()}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(new Headers(options?.headers).entries()),
  };

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      JSON.stringify({
        status: response.status,
        message: body?.message ?? response.statusText,
      }),
    );
  }

  return response.json() as Promise<T>;
}

export const reactionApi = {
  /**
   * Get summary counts for one or many targets (unauthenticated)
   */
  summary: async (
    targetIds: string[],
    options: ReactionContextQuery = { contextUnitId: null },
  ): Promise<ReactionSummaryResponse> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    appendContextQuery(qs, options.contextUnitId);
    const queryString = qs.toString();
    return reactionFetch<ReactionSummaryResponse>(
      `/reaction/summary${queryString ? `?${queryString}` : ""}`,
    );
  },

  shareSummary: async (targetIds: string[]): Promise<ShareSummaryResponse> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    const queryString = qs.toString();
    return reactionFetch<ShareSummaryResponse>(
      `/reaction/share/summary${queryString ? `?${queryString}` : ""}`,
    );
  },

  /**
   * Get current user's reactions for one or many targets
   */
  my: async (
    targetIds: string[],
    options: ReactionContextQuery = { contextUnitId: null },
  ): Promise<ReactionMyResponse> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    appendContextQuery(qs, options.contextUnitId);
    const queryString = qs.toString();
    return reactionFetch<ReactionMyResponse>(
      `/reaction/my${queryString ? `?${queryString}` : ""}`,
    );
  },

  /**
   * Create a reaction for the current user (idempotent).
   * Writes are routed through the main server.
   */
  create: async (input: ReactionCreateInput): Promise<ReactionDTO> => {
    return apiFetch<ReactionDTO>("/reaction", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  share: async (input: ShareCreateInput): Promise<ShareCreateResponse> => {
    return apiFetch<ShareCreateResponse>("/reaction/share", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a reaction for the current user (idempotent).
   * Writes are routed through the main server.
   */
  remove: async (query: ReactionDeleteQuery): Promise<{ deleted: boolean }> => {
    const qs = new URLSearchParams({
      targetId: query.targetId,
      reaction: query.reaction,
    });
    appendContextQuery(qs, query.contextUnitId ?? null);
    return apiFetch<{ deleted: boolean }>(`/reaction?${qs.toString()}`, {
      method: "DELETE",
    });
  },

  /**
   * List a profile's given reaction events (hydrated, paginated).
   * Routed through the main server, NOT directly to the reaction service.
   */
  given: async (
    userId: string,
    query: ReactionHistoryQuery = {},
  ): Promise<ReactionHistoryPage<ReactionHistoryGivenItem>> => {
    const qs = new URLSearchParams();
    if (query.reactions) qs.set("reactions", query.reactions);
    appendContextQuery(qs, query.contextUnitId);
    if (query.cursor) qs.set("cursor", query.cursor);
    if (query.limit !== undefined) qs.set("limit", String(query.limit));
    const search = qs.toString();
    return apiFetch<ReactionHistoryPage<ReactionHistoryGivenItem>>(
      `/profile/${encodeURIComponent(userId)}/reaction/given${search ? `?${search}` : ""}`,
    );
  },

  /**
   * List a profile's received reaction events (hydrated, paginated).
   * Routed through the main server, NOT directly to the reaction service.
   */
  received: async (
    userId: string,
    query: ReactionHistoryQuery = {},
  ): Promise<ReactionHistoryPage<ReactionHistoryReceivedItem>> => {
    const qs = new URLSearchParams();
    if (query.reactions) qs.set("reactions", query.reactions);
    if (query.cursor) qs.set("cursor", query.cursor);
    if (query.limit !== undefined) qs.set("limit", String(query.limit));
    const search = qs.toString();
    return apiFetch<ReactionHistoryPage<ReactionHistoryReceivedItem>>(
      `/profile/${encodeURIComponent(userId)}/reaction/received${search ? `?${search}` : ""}`,
    );
  },
};
