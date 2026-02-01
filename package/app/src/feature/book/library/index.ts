/**
 * Book Library Feature - Public API
 *
 * This is the single entry point for all book library feature exports.
 * External consumers should ONLY import from this file, never from internal paths.
 *
 * @module feature/book/library
 */

// ============================================================================
// Page Components (Route-level entry points)
// ============================================================================

/** Book library list page. */
export {BookLibPage} from './page/BookLibPage';

/** Book detail page. */
export {BookDetailPage} from './page/BookPage';

// Backward compatible aliases
export {BookLibPage as BookLibContainer} from './page/BookLibPage';
export {BookDetailPage as BookPageContainer} from './page/BookPage';

// ============================================================================
// Section Components (Page-composable modules)
// ============================================================================

export {
  BookDetailSection,
  type BookDetailSectionProps,
  type BookDetailTabValue,
} from './ui/section/BookDetailSection';

export {BookHeroSection} from './ui/section/BookHeroSection';

export {
  BookLibSection,
  BookLibSectionRef,
  type BookLibSectionProps,
} from './ui/section/BookLibSection';

// Backward compatible aliases
export {BookLibSection as BookLibShow} from './ui/section/BookLibSection';
export {BookLibSectionRef as BookLibShowRef} from './ui/section/BookLibSection';
export {BookDetailSection as BookDetailView} from './ui/section/BookDetailSection';

// ============================================================================
// UI Components (Reusable building blocks)
// ============================================================================

export {
  BookSearchInput,
  type BookSearchInputProps,
} from './ui/component/BookSearch/BookSearch';

export {
  BookListView,
  BookListViewItem,
  type BookListViewProps,
  type BookListViewItemProps,
} from './ui/component/BookList/BookListView';

export {
  ChapterTreeView,
  ChapterLeaf,
  ChapterList,
  type ChapterTreeHandle,
} from './ui/component/Chapter/ChapterList';

// Backward compatible aliases
export {BookSearchInput as BookSearchContainer} from './ui/component/BookSearch/BookSearch';
export {BookListView as BookListViewContainer} from './ui/component/BookList/BookListView';
export {BookListView as BookListViewShow} from './ui/component/BookList/BookListView';
export {ChapterList as ChapterListContainer} from './ui/component/Chapter/ChapterList';

// ============================================================================
// State (Jotai atoms and hooks)
// ============================================================================

export {
  type Book,
  type BookDetailLoadingState,
  bookDetailAtomFamily,
  setBookDetailAtomFamily,
  patchBookDetailAtomFamily,
} from './state';
