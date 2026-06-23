import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const PAGE_SIZE = 25;

export interface PostListArgs {
  readonly realmUnitId?: string;
  readonly authorUserId?: string;
  readonly parentUnitId?: string;
  readonly kind?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// Paginated post list with optional filters
// 分页帖子列表，支持可选过滤条件
export const postListQuery = (args: PostListArgs = {}) =>
  ApiClient.query("posts", "list", {
    query: {
      realmUnitId: args.realmUnitId,
      authorUserId: args.authorUserId,
      parentUnitId: args.parentUnitId,
      kind: args.kind,
      limit: args.limit ?? PAGE_SIZE,
      offset: args.offset ?? 0,
    },
    reactivityKeys: [Keys.posts],
  });

// Single post by unitId
// 按 unitId 获取单个帖子
export const postQuery = (unitId: string) =>
  ApiClient.query("posts", "get", {
    params: { unitId },
    reactivityKeys: [Keys.post(unitId)],
  });

export const createPostAtom = ApiClient.mutation("posts", "create");
export const updatePostAtom = ApiClient.mutation("posts", "update");
export const deletePostAtom = ApiClient.mutation("posts", "delete");
export const publishPostAtom = ApiClient.mutation("posts", "publish");
