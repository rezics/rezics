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

/** Book info edit page. */
export {BookEditMainPage} from './page/InfoPage';

/** New book creation page. */
export {NewBookPage} from './page/NewBookPage';

/** Chapter list edit page. */
export {BookEditChapterListPage} from './page/ChapterListPage';

/** Single chapter edit page. */
export {BookEditChapterPage} from './page/ChapterPage';

/** Book tag edit page. */
export {BookEditTagPage} from './page/TagPage';

// ============================================================================
// UI Components (Reusable building blocks)
// ============================================================================

export {
  BookExtraEditor,
  type BookExtraData,
} from './ui/component/Metadata/BookExtraEditor';

export {
  BookMetadataEditor,
  type BookMetadataValue,
} from './ui/component/Metadata/BookMetadataEditor';

export {NewBookByUrl} from './ui/component/Metadata/NewBookByUrl';
