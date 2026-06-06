/**
 * Meilisearch API client
 *
 * Frontend wrapper around the backend Meili search endpoints.
 */

import type {
  CommentSearchOptions,
  CommentSearchResult,
  ContentSearchOptions,
  ContentSearchResult,
  FeedbackListQuery,
  FeedbackSearchResult,
  PollSearchOptions,
  PollSearchResult,
  PostSearchOptions,
  PostSearchResult,
  RealmSearchOptions,
  RealmSearchResult,
  UserDTO,
  UserListQuery,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

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

// ANCHOR: Post search

export const meiliPostApi = {
  postSearch: async (opts: PostSearchOptions): Promise<PostSearchResult> => {
    return apiFetch<PostSearchResult>(`/meili/posts/search`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: Poll search

export const meiliPollApi = {
  pollSearch: async (opts: PollSearchOptions): Promise<PollSearchResult> => {
    return apiFetch<PollSearchResult>(`/meili/polls/search`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: Comment search

export const meiliCommentApi = {
  commentSearch: async (
    opts: CommentSearchOptions,
  ): Promise<CommentSearchResult> => {
    return apiFetch<CommentSearchResult>(`/meili/comments/search`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: Realm search

export const meiliRealmApi = {
  realmSearch: async (opts: RealmSearchOptions): Promise<RealmSearchResult> => {
    return apiFetch<RealmSearchResult>(`/meili/realms/search`, {
      method: "POST",
      body: JSON.stringify(opts),
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
