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

// Types
export type {
  ChapterDTO,
  ChapterDetailDTO,
  ChapterListItemDTO,
  CreateChapterInput,
  UpdateChapterInput,
  ChapterFormData,
  ChapterFilters,
  ChapterSortOption,
  ChapterView,
  ChapterListQuery,
  ChapterListResponse,
  ChapterResponse,
} from './chapter.types';

// Query Keys
export {chapterKeys} from './chapter.keys';

// API Client
export {chapterApi} from './chapter.api';

// Query Configurations
export {
  chapterQueries,
  chapterListQuery,
  chapterDetailQuery,
  chapterSearchQuery,
  chaptersByUserQuery,
  chaptersByTargetUnitQuery,
  chapterInfiniteListQuery,
} from './chapter.queries';

// Mutation Hooks
export {
  chapterMutations,
  useCreateChapterMutation,
  useUpdateChapterMutation,
  useDeleteChapterMutation,
} from './chapter.mutations';
