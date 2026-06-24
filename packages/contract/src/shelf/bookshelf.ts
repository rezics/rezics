import { t } from "elysia";
import {
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE,
  UnitType,
} from "../unit/unit";

// ============================================================
// BOOKSHELF VIEW CONFIG
// ============================================================
//
// The "bookshelf" shelf view renders library items as a responsive
// cover grid. The viewer's column counts per breakpoint and whether
// titles are shown are user-configurable through `userSettings.library`.
// A standalone shelf page may also receive a config via URL state; the
// resolution order is URL → viewer settings → DEFAULT_BOOKSHELF_CONFIG.
//
// “bookshelf” 书架视图将库内条目渲染为响应式的封面网格。每个断点的列数以及
// 是否显示标题，可由用户通过 `userSettings.library` 配置。独立的书架页面也
// 可能通过 URL 状态接收配置；解析顺序为 URL → 查看者设置 →
// DEFAULT_BOOKSHELF_CONFIG。

/**
 * A single responsive breakpoint: at >= `minWidthPx`, render `columns`.
 * 单个响应式断点：当宽度 >= `minWidthPx` 时，渲染 `columns` 列。
 */
export const bookshelfBreakpointSchema = t.Object({
  minWidthPx: t.Integer({ minimum: 0 }),
  columns: t.Integer({ minimum: 1, maximum: 24 }),
});

export type BookshelfBreakpoint = (typeof bookshelfBreakpointSchema)["static"];

export const bookshelfViewConfigSchema = t.Object({
  /**
   * Ascending-by-`minWidthPx` breakpoint list. The viewer picks the last
   * breakpoint whose `minWidthPx` is <= the current container width.
   * 按 `minWidthPx` 升序排列的断点列表。查看者选取最后一个 `minWidthPx`
   * 小于等于当前容器宽度的断点。
   */
  breakpoints: t.Array(bookshelfBreakpointSchema, { minItems: 1 }),
  /**
   * Whether the item title is rendered beneath each cover.
   * 是否在每个封面下方渲染条目标题。
   */
  showTitle: t.Boolean(),
});

export type BookshelfViewConfig = (typeof bookshelfViewConfigSchema)["static"];

/**
 * Baseline grid: scales from 3 columns on phones to 8 on wide desktops.
 * 基准网格：从手机上的 3 列扩展到宽屏桌面上的 8 列。
 */
export const DEFAULT_BOOKSHELF_CONFIG: BookshelfViewConfig = {
  breakpoints: [
    { minWidthPx: 0, columns: 3 },
    { minWidthPx: 640, columns: 4 },
    { minWidthPx: 768, columns: 5 },
    { minWidthPx: 1024, columns: 6 },
    { minWidthPx: 1280, columns: 8 },
  ],
  showTitle: true,
};

// ============================================================
// LIBRARY KINDS
// 库类型
// ============================================================

/**
 * Unit kinds that participate in a personal library / bookshelf view.
 * Shelf items of other kinds are silently skipped by the bookshelf view.
 * 参与个人库 / 书架视图的 Unit 类型。其他类型的书架条目会被书架视图静默跳过。
 */
export const LIBRARY_KINDS = ["book", "game", "media"] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export function isLibraryKind(kind: string): kind is LibraryKind {
  return (LIBRARY_KINDS as readonly string[]).includes(kind);
}

/**
 * Cover aspect ratio (width / height) per shelf library kind. The Unit-level
 * source of truth is `CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE`; these lowercase
 * aliases keep shelf/bookshelf payloads aligned with that contract.
 * 每种 shelf library 类型的封面宽高比（宽 / 高）。Unit 级事实来源是
 * `CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE`；这些小写别名让
 * shelf/bookshelf payload 与该 contract 保持一致。
 */
export const BOOK_ASPECT_RATIO =
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE[UnitType.BOOK];
export const GAME_ASPECT_RATIO =
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE[UnitType.GAME];
export const MEDIA_ASPECT_RATIO =
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE[UnitType.MEDIA];

export const LIBRARY_KIND_ASPECT_RATIO: Record<LibraryKind, number> = {
  book: BOOK_ASPECT_RATIO,
  game: GAME_ASPECT_RATIO,
  media: MEDIA_ASPECT_RATIO,
};
