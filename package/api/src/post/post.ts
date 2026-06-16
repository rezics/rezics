/**
 * Post API - Main entry point
 * Posts are top-level discussion entities. Reply trees use comment APIs.
 * Post API - 主入口
 * Post 是顶层讨论实体。回复树使用 comment API。
 *
 * File organization:
 * 文件组织：
 * - post.types.ts: TypeScript types and interfaces。TypeScript 类型与接口
 * - post.keys.ts: React Query key factory。React Query 键工厂
 * - post.api.ts: API client functions。API 客户端函数
 * - post.queries.ts: Query configurations。查询配置
 * - post.mutations.ts: Mutation hooks。变更 hooks
 * - post.ts: Main entry (this file) - unified exports。主入口（本文件）——统一导出
 */

export { postApi } from "./post.api";

export { postKeys } from "./post.keys";
export {
  postMutations,
  useAcceptAnswerMutation,
  useCreatePostMutation,
  useCreateWikiPostMutation,
  useDeletePostMutation,
  usePinCommentMutation,
  useSetPostPublicationMutation,
  useSetPostStateMutation,
  useSubmitPostToRealmMutation,
  useUnacceptAnswerMutation,
  useUnpinCommentMutation,
  useUpdatePostMutation,
  useUpdateWikiPostContentMutation,
} from "./post.mutations";

export {
  postDetailQuery,
  postInfiniteListQuery,
  postListQuery,
  postQueries,
  postsByAuthorQuery,
  postsByRealmQuery,
  postsByTargetQuery,
  postsByVariantQuery,
  wikiPostsByRealmQuery,
  wikiPostsByTargetQuery,
} from "./post.queries";
export type {
  CreatePostInput,
  CreateRootPostInput,
  PostDTO,
  PostFilters,
  PostFormData,
  PostListResponse,
  PostResponse,
  PostSortOption,
  PostView,
  UpdatePostInput,
} from "./post.types";
