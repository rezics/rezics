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
export { BookBasicInfoPage } from "./pages/BookBasicInfoPage";
export { BookContentPage } from "./pages/BookContentPage";
/** Book detail layout (shared hero + data fetching). */
export { BookDetailLayout } from "./pages/BookDetailLayout";
export { BookCommunityPage } from "./pages/BookDiscussionPage";
/** Book library curated homepage. */
export { BookHomePage } from "./pages/BookHomePage";
/** Book library list page. */
export { BookLibPage } from "./pages/BookLibPage";
export { BookReviewPage } from "./pages/BookReviewPage";

// ============================================================================
// Section Components (Page-composable modules)
// ============================================================================

export {
  BookDetailShell,
  type BookDetailShellProps,
} from "./sections/BookDetailSection";
export { BookHeroSection } from "./sections/BookHeroSection";
export {
  BookLibSection,
  type BookLibSectionProps,
  BookLibSectionRef,
} from "./sections/BookLibSection";

// ============================================================================
// UI Components (Reusable building blocks)
// ============================================================================

export {
  BookListView,
  BookListViewItem,
  type BookListViewItemProps,
  type BookListViewProps,
} from "./components/BookList/BookListView";
export {
  BookSearch,
  type BookSearchProps,
} from "./components/BookSearch/BookSearch";
export {
  ChapterLeaf,
  ChapterList,
  type BookTocTreeHandle,
  BookTocTreeView,
} from "./components/Chapter/ChapterList";

// ============================================================================
// State (Jotai atoms and hooks)
// ============================================================================

export {
  useEnsureChapterUnit,
  type EnsureChapterUnitInput,
} from "./hooks/useEnsureChapterUnit";
export {
  type Book,
  type BookDetailLoadingState,
  bookDetailAtomFamily,
  patchBookDetailAtomFamily,
  setBookDetailAtomFamily,
} from "./states";
