/**
 * React Query configurations for Meilisearch content queries
 * 用于 Meilisearch 内容查询的 React Query 配置
 */

import type {
  CommentSearchOptions,
  ContentSearchOptions,
  ContentSearchResult,
  FeedbackListResponse,
  FeedbackType,
  PollSearchOptions,
  PostSearchOptions,
  RealmSearchOptions,
  UserListQuery,
} from "@rezics/contract";
import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import {
  meiliCommentApi,
  meiliContentApi,
  meiliFeedbackApi,
  meiliPollApi,
  meiliPostApi,
  meiliRealmApi,
  meiliUserApi,
} from "./meili.api";

// ANCHOR: Content search 内容搜索

export const contentSearchQueryOptions = (opts: ContentSearchOptions) =>
  queryOptions({
    queryKey: ["meili", "content", opts],
    queryFn: () => meiliContentApi.contentSearch(opts),
    staleTime: 1000 * 60 * 2,
  });

export function useContentSearch(opts: ContentSearchOptions) {
  return useQuery(contentSearchQueryOptions(opts));
}

// ANCHOR: User search 用户搜索

export const userSearchQueryOptions = (opts: UserListQuery) =>
  queryOptions({
    queryKey: ["meili", "users", opts],
    queryFn: () => meiliUserApi.userSearch(opts),
    staleTime: 1000 * 60 * 2,
  });

export function useUserSearchQuery(opts: UserListQuery) {
  return useQuery(userSearchQueryOptions(opts));
}

// ANCHOR: Feedback search 反馈搜索

type FeedbackExtraFilterOptions = {
  userId?: string;
  type?: FeedbackType;
  resolved?: boolean;
};

export const buildMeiliFeedbackQuery = (
  offset: number,
  limit: number,
  keyword: string,
  options?: FeedbackExtraFilterOptions,
) => {
  const filters = {
    offset,
    limit,
    q: keyword || undefined,
    ...(options?.userId ? { userId: options.userId } : {}),
    ...(options?.type ? { type: options.type } : {}),
    ...(typeof options?.resolved === "boolean"
      ? { resolved: options.resolved }
      : {}),
  } as const;

  return {
    queryKey: [
      "meili-feedbacks",
      offset,
      limit,
      keyword,
      options?.userId ?? null,
      options?.type ?? null,
      typeof options?.resolved === "boolean" ? options.resolved : null,
    ],
    queryFn: async (): Promise<FeedbackListResponse> => {
      const searchResult = await meiliFeedbackApi.feedbackSearch(filters);
      return {
        items: searchResult.feedbacks as any[],
        offset,
        totalItems: searchResult.total,
      };
    },
    staleTime: 1000 * 60 * 5,
  } as const;
};

// ANCHOR: Post search 帖子搜索

export const postSearchQueryOptions = (opts: PostSearchOptions) =>
  queryOptions({
    queryKey: ["meili", "posts", opts],
    queryFn: () => meiliPostApi.postSearch(opts),
    staleTime: 1000 * 60 * 2,
  });

export function usePostSearchQuery(opts: PostSearchOptions) {
  return useQuery(postSearchQueryOptions(opts));
}

// ANCHOR: Poll search 投票搜索

export const pollSearchQueryOptions = (opts: PollSearchOptions) =>
  queryOptions({
    queryKey: ["meili", "polls", opts],
    queryFn: () => meiliPollApi.pollSearch(opts),
    staleTime: 1000 * 60 * 2,
  });

export function usePollSearchQuery(opts: PollSearchOptions) {
  return useQuery(pollSearchQueryOptions(opts));
}

export function usePostSearchInfiniteQuery(
  opts: Omit<PostSearchOptions, "offset">,
) {
  const limit = opts.limit ?? 20;
  return useInfiniteQuery({
    queryKey: ["meili", "posts", "infinite", opts],
    queryFn: ({ pageParam = 0 }) =>
      meiliPostApi.postSearch({ ...opts, offset: pageParam, limit }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.items.length < limit) return undefined;
      return lastPageParam + limit;
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ANCHOR: Comment search 评论搜索

export const commentSearchQueryOptions = (opts: CommentSearchOptions) =>
  queryOptions({
    queryKey: ["meili", "comments", opts],
    queryFn: () => meiliCommentApi.commentSearch(opts),
    staleTime: 1000 * 60 * 2,
  });

export function useCommentSearchQuery(opts: CommentSearchOptions) {
  return useQuery(commentSearchQueryOptions(opts));
}

export function useCommentSearchInfiniteQuery(
  opts: Omit<CommentSearchOptions, "offset">,
) {
  const limit = opts.limit ?? 20;
  return useInfiniteQuery({
    queryKey: ["meili", "comments", "infinite", opts],
    queryFn: ({ pageParam = 0 }) =>
      meiliCommentApi.commentSearch({ ...opts, offset: pageParam, limit }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.items.length < limit) return undefined;
      return lastPageParam + limit;
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ANCHOR: Realm search 领域搜索

export const realmSearchQueryOptions = (opts: RealmSearchOptions) =>
  queryOptions({
    queryKey: ["meili", "realms", opts],
    queryFn: () => meiliRealmApi.realmSearch(opts),
    staleTime: 1000 * 60 * 2,
  });

export function useRealmSearchQuery(opts: RealmSearchOptions) {
  return useQuery(realmSearchQueryOptions(opts));
}

export function useRealmSearchInfiniteQuery(
  opts: Omit<RealmSearchOptions, "offset">,
) {
  const limit = opts.limit ?? 20;
  return useInfiniteQuery({
    queryKey: ["meili", "realms", "infinite", opts],
    queryFn: ({ pageParam = 0 }) =>
      meiliRealmApi.realmSearch({ ...opts, offset: pageParam, limit }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.items.length < limit) return undefined;
      return lastPageParam + limit;
    },
    staleTime: 1000 * 60 * 2,
  });
}
