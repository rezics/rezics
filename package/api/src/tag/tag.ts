/**
 * Tag API - Main entry point
 * Tags are Units with type=TAG. Scored associations and voting are managed
 * through attach/detach/vote endpoints.
 */

// API client
export { tagApi } from "./tag.api";

// Keys
export { tagKeys } from "./tag.keys";
// Mutations
export {
  tagMutations,
  useAttachTagMutation,
  useCastTagVoteMutation,
  useCreateTagMutation,
  useDeleteTagMutation,
  useDetachTagMutation,
  useUpdateTagMutation,
} from "./tag.mutations";

// Queries
export {
  tagBatchTranslationsQuery,
  tagContextQuery,
  tagDetailQuery,
  tagInfiniteListQuery,
  tagListQuery,
  tagQueries,
  tagSearchQuery,
  tagsForUnitQuery,
} from "./tag.queries";
// Types
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
