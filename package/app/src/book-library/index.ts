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
export {
  BookBasicInfoPage,
  BookBasicInfoPage as OverviewPage,
} from "./pages/BookBasicInfoPage";
export { BookContentPage } from "./pages/BookContentPage";
export {
  BookDiscussionPage,
  BookCommunityPage,
} from "./pages/BookDiscussionPage";
/** Book detail layout (shared hero + data fetching). */
export { BookDetailLayout } from "./pages/BookDetailLayout";
/** Book library list page. */
// Backward compatible aliases
export {
  BookLibPage,
  BookLibPage as BookLibContainer,
} from "./pages/BookLibPage";
/** Book library curated homepage. */
export { BookHomePage } from "./pages/BookHomePage";
export {
  BookReviewPage,
  BookReviewPage as ReviewShelfPage,
} from "./pages/BookReviewPage";

// ============================================================================
// Section Components (Page-composable modules)
// ============================================================================

export {
  BookDetailShell,
  BookDetailShell as BookDetailView,
  type BookDetailShellProps,
} from "./sections/BookDetailSection";
export { BookHeroSection } from "./sections/BookHeroSection";
// Backward compatible aliases
export {
  BookLibSection,
  BookLibSection as BookLibShow,
  type BookLibSectionProps,
  BookLibSectionRef,
  BookLibSectionRef as BookLibShowRef,
} from "./sections/BookLibSection";

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
} from "./components/BookList/BookListView";
// Backward compatible aliases
export {
  BookSearchInput,
  BookSearchInput as BookSearchContainer,
  type BookSearchInputProps,
} from "./components/BookSearch/BookSearch";
export {
  ChapterLeaf,
  ChapterList,
  ChapterList as ChapterListContainer,
  type ChapterTreeHandle,
  ChapterTreeView,
} from "./components/Chapter/ChapterList";

// ============================================================================
// State (Jotai atoms and hooks)
// ============================================================================

export {
  type Book,
  type BookDetailLoadingState,
  bookDetailAtomFamily,
  patchBookDetailAtomFamily,
  setBookDetailAtomFamily,
} from "./states";
