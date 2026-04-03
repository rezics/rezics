/**
 * Tag API - Main entry point
 * Mirrors the structure used by Book API module
 */

// Types
export type {
  TagDTO,
  TagDetailDTO,
  CreateTagInput,
  UpdateTagInput,
  TagListQuery,
} from '@rezics/contract';
export type {TagFormData, TagFilters, TagView} from './tag.types';

// Keys
export {tagKeys} from './tag.keys';

// API client
export {tagApi} from './tag.api';

// Queries
export {
  tagQueries,
  tagListQuery,
  tagDetailQuery,
  tagByNameQuery,
  tagByObjectQuery,
  tagInfiniteListQuery,
} from './tag.queries';

// Mutations
export {
  tagMutations,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useAttachTagMutation,
  useDetachTagMutation,
} from './tag.mutations';
