/**
 * Book Edit Feature - Public API
 * Book Edit 功能 - 公共 API
 *
 * This is the single entry point for all book edit feature exports.
 * External consumers should ONLY import from this file, never from internal paths.
 * 这是 book edit 功能所有导出的唯一入口。
 * 外部消费者只应从此文件导入，绝不要从内部路径导入。
 *
 * @module feature/book/edit
 */

// ============================================================================
// Page Components (Route-level entry points)
// 页面组件（路由级入口）
// ============================================================================

/** Book authority and field-lock management page.
 *  图书权威与字段锁定管理页面。 */
export {
  BookAuthorityPage,
  BookAuthorityPanel,
} from "./pages/BookAuthorityPage";
/** Chapter list edit page.
 *  章节列表编辑页面。 */
export { BookEditChapterListPage } from "./pages/ChapterListPage";
/** Single chapter edit page.
 *  单章节编辑页面。 */
export { BookEditChapterPage } from "./pages/ChapterPage";
/** Book info edit page.
 *  图书信息编辑页面。 */
export { BookEditMainPage } from "./pages/InfoPage";
/** New book creation page.
 *  新图书创建页面。 */
export { NewBookPage } from "./pages/NewBookPage";

/** Book tag edit page.
 *  图书标签编辑页面。 */
export { BookEditTagPage } from "./pages/TagPage";

// ============================================================================
// UI Components (Reusable building blocks)
// UI 组件（可复用构建块）
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
