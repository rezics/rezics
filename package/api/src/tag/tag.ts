/**
 * Tag API - Main entry point
 * Mirrors the structure used by Book API module
 */

// Types
export type {
  CreateTagInput,
  TagDetailDTO,
  TagDTO,
  TagListQuery,
  UpdateTagInput,
} from "@rezics/contract";
// API client
export { tagApi } from "./tag.api";

// Keys
export { tagKeys } from "./tag.keys";
// Mutations
export {
  tagMutations,
  useAttachTagMutation,
  useCreateTagMutation,
  useDeleteTagMutation,
  useDetachTagMutation,
  useUpdateTagMutation,
} from "./tag.mutations";

// Queries
export {
  tagByNameQuery,
  tagByObjectQuery,
  tagDetailQuery,
  tagInfiniteListQuery,
  tagListQuery,
  tagQueries,
} from "./tag.queries";
export type { TagFilters, TagFormData, TagView } from "./tag.types";
