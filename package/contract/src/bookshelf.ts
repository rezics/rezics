import { t } from "elysia";

// ============================================================
// BOOKSHELF VIEW CONFIG
// ============================================================
//
// The "bookshelf" shelf view renders library items as a responsive
// cover grid. The viewer's column counts per breakpoint and whether
// titles are shown are user-configurable through `userSettings.library`.
// A standalone shelf page may also receive a config via URL state; the
// resolution order is URL → viewer settings → DEFAULT_BOOKSHELF_CONFIG.

/** A single responsive breakpoint: at >= `minWidthPx`, render `columns`. */
export const bookshelfBreakpointSchema = t.Object({
  minWidthPx: t.Integer({ minimum: 0 }),
  columns: t.Integer({ minimum: 1, maximum: 24 }),
});

export type BookshelfBreakpoint =
  (typeof bookshelfBreakpointSchema)["static"];

export const bookshelfViewConfigSchema = t.Object({
  /**
   * Ascending-by-`minWidthPx` breakpoint list. The viewer picks the last
   * breakpoint whose `minWidthPx` is <= the current container width.
   */
  breakpoints: t.Array(bookshelfBreakpointSchema, { minItems: 1 }),
  /** Whether the item title is rendered beneath each cover. */
  showTitle: t.Boolean(),
});

export type BookshelfViewConfig =
  (typeof bookshelfViewConfigSchema)["static"];

/** Baseline grid: scales from 3 columns on phones to 8 on wide desktops. */
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
// ============================================================

/**
 * Unit kinds that participate in a personal library / bookshelf view.
 * Shelf items of other kinds are silently skipped by the bookshelf view.
 */
export const LIBRARY_KINDS = ["book", "game", "media"] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export function isLibraryKind(kind: string): kind is LibraryKind {
  return (LIBRARY_KINDS as readonly string[]).includes(kind);
}

/**
 * Cover aspect ratio (width / height) per library kind. Kept independent
 * even where values coincide so a single kind can change without
 * affecting the others.
 */
export const BOOK_ASPECT_RATIO = 2 / 3;
export const GAME_ASPECT_RATIO = 3 / 4;
export const MEDIA_ASPECT_RATIO = 2 / 3;

export const LIBRARY_KIND_ASPECT_RATIO: Record<LibraryKind, number> = {
  book: BOOK_ASPECT_RATIO,
  game: GAME_ASPECT_RATIO,
  media: MEDIA_ASPECT_RATIO,
};
