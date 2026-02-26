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

/** Book detail layout (shared hero + data fetching). */
export {BookDetailLayout} from './page/BookDetailLayout';

/** Book detail sub-pages (routed tabs). */
export {BookBasicInfoPage} from './page/BookBasicInfoPage';
export {BookReviewPage} from './page/BookReviewPage';
export {BookContentPage} from './page/BookContentPage';

// Backward compatible aliases
export {BookLibPage as BookLibContainer} from './page/BookLibPage';

// ============================================================================
// Section Components (Page-composable modules)
// ============================================================================

export {
  BookDetailShell,
  type BookDetailShellProps,
} from './section/BookDetailSection';

export {BookHeroSection} from './section/BookHeroSection';

export {
  BookLibSection,
  BookLibSectionRef,
  type BookLibSectionProps,
} from './section/BookLibSection';

// Backward compatible aliases
export {BookLibSection as BookLibShow} from './section/BookLibSection';
export {BookLibSectionRef as BookLibShowRef} from './section/BookLibSection';
export {BookDetailShell as BookDetailView} from './section/BookDetailSection';

// ============================================================================
// UI Components (Reusable building blocks)
// ============================================================================

export {
  BookSearchInput,
  type BookSearchInputProps,
} from './component/BookSearch/BookSearch';

export {
  BookListView,
  BookListViewItem,
  type BookListViewProps,
  type BookListViewItemProps,
} from './component/BookList/BookListView';

export {
  ChapterTreeView,
  ChapterLeaf,
  ChapterList,
  type ChapterTreeHandle,
} from './component/Chapter/ChapterList';

// Backward compatible aliases
export {BookSearchInput as BookSearchContainer} from './component/BookSearch/BookSearch';
export {BookListView as BookListViewContainer} from './component/BookList/BookListView';
export {BookListView as BookListViewShow} from './component/BookList/BookListView';
export {ChapterList as ChapterListContainer} from './component/Chapter/ChapterList';

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
