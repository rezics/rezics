/**
 * Meilisearch API client
 *
 * Frontend wrapper around the backend Meili search endpoints.
 */

import type {
  ContentSearchOptions,
  ContentSearchResult,
  FeedbackListQuery,
  FeedbackSearchResult,
  UserDTO,
  UserListQuery,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export * from "./mapper";

// ANCHOR: Content search

export const meiliContentApi = {
  contentSearch: async (
    opts: ContentSearchOptions,
  ): Promise<ContentSearchResult> => {
    return apiFetch<ContentSearchResult>(`/meili/content/search`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: Feedback search

export const meiliFeedbackApi = {
  feedbackSearch: async (
    filters?: FeedbackListQuery,
  ): Promise<FeedbackSearchResult> => {
    return apiFetch<FeedbackSearchResult>(`/meili/feedbacks/search`, {
      method: "POST",
      body: JSON.stringify(filters),
    });
  },
};

// ANCHOR: User search

export type UserSearchResponse = {
  users: Omit<UserDTO, "email">[];
  total: number;
};

export const meiliUserApi = {
  userSearch: async (query?: UserListQuery): Promise<UserSearchResponse> => {
    return apiFetch<UserSearchResponse>(
      `/meili/users/search${buildQueryString(query as any)}`,
    );
  },
};
