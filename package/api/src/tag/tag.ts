/**
 * Tag API - Main entry point
 * Tags are Units with type=TAG. Scored associations and voting are managed
 * through attach/detach/vote endpoints.
 * Tag API - 主入口。
 * 标签是 type=TAG 的 Unit。带评分的关联与投票通过 attach/detach/vote 端点管理。
 */

// Helpers
// 辅助函数。
export {
  generateKeyBetween,
  POSITION_ALPHABET,
  positionForNewBottomPin,
  positionForNewTopPin,
} from "./fractional-index";
export {
  sortRealmTagsByPinThenScore,
  sortTagsByPinThenScore,
} from "./sort";
// API client
// API 客户端。
export { tagApi } from "./tag.api";
// Keys
// 查询键。
export { tagKeys } from "./tag.keys";
// Mutations
// 变更操作。
export {
  tagMutations,
  useAttachTagMutation,
  useCastTagVoteMutation,
  useCreateTagMutation,
  useCreateUnitTagMutation,
  useDeleteTagMutation,
  useDeleteUnitTagMutation,
  useDetachTagMutation,
  usePatchUnitTagMutation,
  useUpdateTagMutation,
} from "./tag.mutations";
// Queries
// 查询。
export {
  lowScoreTagsQuery,
  tagBatchTranslationsQuery,
  tagBySlugQuery,
  tagContextQuery,
  tagDetailQuery,
  tagInfiniteListQuery,
  tagListQuery,
  tagQueries,
  tagSearchQuery,
  tagsForUnitQuery,
} from "./tag.queries";

// Types
// 类型。
export type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  DetachTagInput,
  TagFilters,
  TagFormData,
  TagView,
  TagVoteDTO,
  UnitTagDTO,
  UpdateTagInput,
} from "./tag.types";
