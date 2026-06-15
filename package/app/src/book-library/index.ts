/**
 * Book Library Feature - Public API
 * Book Library 功能 - 公共 API
 *
 * This is the single entry point for all book library feature exports.
 * External consumers should ONLY import from this file, never from internal paths.
 * 这是 book library 功能所有导出的唯一入口。
 * 外部消费者只应从此文件导入，绝不要从内部路径导入。
 *
 * @module feature/book/library
 */

// ============================================================================
// Page Components (Route-level entry points)
// 页面组件（路由级入口）
// ============================================================================

/** Book detail sub-pages (routed tabs).
 *  图书详情子页面（路由标签页）。 */
export { BookBasicInfoPage } from "./pages/BookBasicInfoPage";
export { BookContentPage } from "./pages/BookContentPage";
/** Book detail layout (shared hero + data fetching).
 *  图书详情布局（共享 hero + 数据获取）。 */
export { BookDetailLayout } from "./pages/BookDetailLayout";
export { BookCommunityPage } from "./pages/BookDiscussionPage";
export {
  BookEditHistoryPage,
  BookEditHistoryTimelinePage,
  BookHistoryPage,
  BookRevisionComparePage,
  BookRevisionPage,
} from "./pages/BookHistoryPage";
/** Book library curated homepage.
 *  图书库精选首页。 */
export { BookHomePage } from "./pages/BookHomePage";
/** Book library list page.
 *  图书库列表页面。 */
export { BookLibPage } from "./pages/BookLibPage";
export { BookReviewPage } from "./pages/BookReviewPage";
export { BookVariantsPage } from "./pages/BookVariantsPage";

// ============================================================================
// Section Components (Page-composable modules)
// 区块组件（可组装到页面的模块）
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
// UI 组件（可复用构建块）
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
  type BookTocTreeHandle,
  BookTocTreeView,
  ChapterLeaf,
  ChapterList,
} from "./components/Chapter/ChapterList";

// ============================================================================
// State (Jotai atoms and hooks)
// 状态（Jotai atom 与 hook）
// ============================================================================

export {
  type EnsureChapterUnitInput,
  useEnsureChapterUnit,
} from "./hooks/useEnsureChapterUnit";
export {
  type Book,
  type BookDetailLoadingState,
  bookDetailAtomFamily,
  patchBookDetailAtomFamily,
  setBookDetailAtomFamily,
} from "./states";

// ============================================================================
// Catalog Cards & Layouts (cross-feature reuse)
// 目录卡片与布局（跨功能复用）
// ============================================================================

export { BookTocJsonEditor } from "./components/Chapter/BookTocJsonEditor";
export { HorizontalBookCard } from "./components/item/HorizontalBookCard";
export { BookCard } from "./components/item/VerticalBookCard";
export { HorizontalBookCarousel } from "./components/list/HorizontalBookCarousel";
export { ResponsiveBookGridLimited } from "./components/list/ResponsiveBookGridLimited";

// ============================================================================
// Domain Models (pure functions & types)
// 领域模型（纯函数与类型）
// ============================================================================

export {
  type BookContentStructureOccurrence,
  contentUnitIdForNode,
  withBookContentStructureOccurrences,
} from "./models/bookContentStructurePath";
export {
  resolveCatalogEntryInteractionContext,
  shelfListFiltersForCatalogEntry,
} from "./models/catalogEntryContext";
export { resolvePostTargetVariantLabel } from "./models/communityStream";
