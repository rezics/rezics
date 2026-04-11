/**
 * Reaction API client functions
 * Calls the standalone reaction service directly
 */

import {
  NormalizedTokenName,
} from "@rezics/contract";
import { getApiConfig } from "../config";
import { buildTokenHeaders } from "../react-query/jwt";
import type {
  ReactionCreateInput,
  ReactionDeleteQuery,
  ReactionDTO,
  ReactionMyResponse,
  ReactionSummaryResponse,
} from "./reaction.types";

function getReactionBaseUrl(): string {
  return getApiConfig().reactionServiceUrl ?? getApiConfig().apiBaseUrl;
}

async function reactionFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${getReactionBaseUrl()}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(new Headers(options?.headers).entries()),
    ...buildTokenHeaders({
      include: [NormalizedTokenName.AUTH_IDENTITY],
    }),
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
  summary: async (targetIds: string[]): Promise<ReactionSummaryResponse> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    const queryString = qs.toString();
    return reactionFetch<ReactionSummaryResponse>(
      `/reactions/summary${queryString ? `?${queryString}` : ""}`,
    );
  },

  /**
   * Get current user's reactions for one or many targets
   */
  my: async (targetIds: string[]): Promise<ReactionMyResponse> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    const queryString = qs.toString();
    return reactionFetch<ReactionMyResponse>(
      `/reactions/my${queryString ? `?${queryString}` : ""}`,
    );
  },

  /**
   * Create a reaction for the current user (idempotent)
   */
  create: async (input: ReactionCreateInput): Promise<ReactionDTO> => {
    return reactionFetch<ReactionDTO>("/reactions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a reaction for the current user (idempotent)
   */
  remove: async (query: ReactionDeleteQuery): Promise<{ deleted: boolean }> => {
    const qs = new URLSearchParams({
      targetId: query.targetId,
      reaction: query.reaction,
    });
    return reactionFetch<{ deleted: boolean }>(
      `/reactions?${qs.toString()}`,
      { method: "DELETE" },
    );
  },
};
