/**
 * Book Edit Feature - Public API
 *
 * This is the single entry point for all book edit feature exports.
 * External consumers should ONLY import from this file, never from internal paths.
 *
 * @module feature/book/edit
 */

// ============================================================================
// Page Components (Route-level entry points)
// ============================================================================

/** Chapter list edit page. */
export { BookEditChapterListPage } from "./pages/ChapterListPage";
/** Single chapter edit page. */
export { BookEditChapterPage } from "./pages/ChapterPage";
/** Book authority and field-lock management page. */
export {
  BookAuthorityPage,
  BookAuthorityPanel,
} from "./pages/BookAuthorityPage";
/** Book info edit page. */
export { BookEditMainPage } from "./pages/InfoPage";
/** New book creation page. */
export { NewBookPage } from "./pages/NewBookPage";

/** Book tag edit page. */
export { BookEditTagPage } from "./pages/TagPage";

// ============================================================================
// UI Components (Reusable building blocks)
// ============================================================================

export {
  type BookExtraData,
  BookExtraEditor,
} from "./components/Metadata/BookExtraEditor";

export {
  BookMetadataEditor,
  type BookMetadataValue,
} from "./components/Metadata/BookMetadataEditor";

export { NewBookByUrl } from "./components/Metadata/NewBookByUrl";
