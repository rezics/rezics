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

/** Book detail sub-pages (routed tabs). */
export { BookBasicInfoPage } from "./page/BookBasicInfoPage";
export { BookContentPage } from "./page/BookContentPage";
/** Book detail layout (shared hero + data fetching). */
export { BookDetailLayout } from "./page/BookDetailLayout";
/** Book library list page. */
// Backward compatible aliases
export {
  BookLibPage,
  BookLibPage as BookLibContainer,
} from "./page/BookLibPage";
export { BookReviewPage } from "./page/BookReviewPage";

// ============================================================================
// Section Components (Page-composable modules)
// ============================================================================

export {
  BookDetailShell,
  BookDetailShell as BookDetailView,
  type BookDetailShellProps,
} from "./section/BookDetailSection";
export { BookHeroSection } from "./section/BookHeroSection";
// Backward compatible aliases
export {
  BookLibSection,
  BookLibSection as BookLibShow,
  type BookLibSectionProps,
  BookLibSectionRef,
  BookLibSectionRef as BookLibShowRef,
} from "./section/BookLibSection";

// ============================================================================
// UI Components (Reusable building blocks)
// ============================================================================

export {
  BookListView,
  BookListView as BookListViewContainer,
  BookListView as BookListViewShow,
  BookListViewItem,
  type BookListViewItemProps,
  type BookListViewProps,
} from "./component/BookList/BookListView";
// Backward compatible aliases
export {
  BookSearchInput,
  BookSearchInput as BookSearchContainer,
  type BookSearchInputProps,
} from "./component/BookSearch/BookSearch";
export {
  ChapterLeaf,
  ChapterList,
  ChapterList as ChapterListContainer,
  type ChapterTreeHandle,
  ChapterTreeView,
} from "./component/Chapter/ChapterList";

// ============================================================================
// State (Jotai atoms and hooks)
// ============================================================================

export {
  type Book,
  type BookDetailLoadingState,
  bookDetailAtomFamily,
  patchBookDetailAtomFamily,
  setBookDetailAtomFamily,
} from "./state";
