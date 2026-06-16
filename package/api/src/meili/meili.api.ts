/**
 * Meilisearch API client
 * Meilisearch API 客户端
 *
 * Frontend wrapper around the backend Meili search endpoints.
 * 后端 Meili 搜索端点的前端封装。
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

// ANCHOR: Content search 内容搜索

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

// ANCHOR: Feedback search 反馈搜索

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

// ANCHOR: Post search 帖子搜索

export const meiliPostApi = {
  postSearch: async (opts: PostSearchOptions): Promise<PostSearchResult> => {
    return apiFetch<PostSearchResult>(`/meili/posts/search`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: Poll search 投票搜索

export const meiliPollApi = {
  pollSearch: async (opts: PollSearchOptions): Promise<PollSearchResult> => {
    return apiFetch<PollSearchResult>(`/meili/polls/search`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: Comment search 评论搜索

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

// ANCHOR: Realm search realm 搜索

export const meiliRealmApi = {
  realmSearch: async (opts: RealmSearchOptions): Promise<RealmSearchResult> => {
    return apiFetch<RealmSearchResult>(`/meili/realms/search`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: User search 用户搜索

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
