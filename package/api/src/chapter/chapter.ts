/**
 * Chapter API - Main entry point
 * Provides a unified interface for all chapter-related operations
 *
 * File organization:
 * - chapter.types.ts: TypeScript types and interfaces
 * - chapter.keys.ts: React Query key factory
 * - chapter.api.ts: API client functions
 * - chapter.queries.ts: Query configurations
 * - chapter.mutations.ts: Mutation hooks
 * - chapter.ts: Main entry (this file) - unified exports
 */

// API Client
export { chapterApi } from "./chapter.api";

// Query Keys
export { chapterKeys } from "./chapter.keys";
// Mutation Hooks
export {
  chapterMutations,
  useCreateChapterMutation,
  useDeleteChapterMutation,
  useUpdateChapterMutation,
} from "./chapter.mutations";

// Query Configurations
export {
  chapterDetailQuery,
  chapterInfiniteListQuery,
  chapterListQuery,
  chapterQueries,
  chapterSearchQuery,
  chaptersByTargetUnitQuery,
  chaptersByUserQuery,
} from "./chapter.queries";
// Types
export type {
  ChapterDetailDTO,
  ChapterDTO,
  ChapterFilters,
  ChapterFormData,
  ChapterListItemDTO,
  ChapterListQuery,
  ChapterListResponse,
  ChapterResponse,
  ChapterSortOption,
  ChapterView,
  CreateChapterInput,
  UpdateChapterInput,
} from "./chapter.types";
