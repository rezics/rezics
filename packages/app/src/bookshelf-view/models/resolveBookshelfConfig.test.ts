import { describe, expect, test } from "bun:test";
import {
  BOOK_ASPECT_RATIO,
  type BookshelfViewConfig,
  DEFAULT_BOOKSHELF_CONFIG,
  GAME_ASPECT_RATIO,
} from "@rezics/contract";
import { applyReadableFilter } from "../models";
import {
  columnsForWidth,
  coverAspectRatioForLibraryKind,
  resolveBookshelfConfig,
} from "./resolveBookshelfConfig";

const URL_CONFIG: BookshelfViewConfig = {
  breakpoints: [{ minWidthPx: 0, columns: 2 }],
  showTitle: false,
};
const VIEWER_CONFIG: BookshelfViewConfig = {
  breakpoints: [{ minWidthPx: 0, columns: 5 }],
  showTitle: true,
};

describe("resolveBookshelfConfig precedence", () => {
  test("URL override wins over viewer settings and default", () => {
    expect(
      resolveBookshelfConfig({ url: URL_CONFIG, viewer: VIEWER_CONFIG }),
    ).toEqual(URL_CONFIG);
  });

  test("viewer settings win when there is no URL override", () => {
    expect(
      resolveBookshelfConfig({ url: null, viewer: VIEWER_CONFIG }),
    ).toEqual(VIEWER_CONFIG);
  });

  test("falls back to the contract default when nothing is provided", () => {
    expect(resolveBookshelfConfig({})).toEqual(DEFAULT_BOOKSHELF_CONFIG);
  });

  test("an empty breakpoint list is invalid and falls through", () => {
    const empty: BookshelfViewConfig = { breakpoints: [], showTitle: true };
    expect(
      resolveBookshelfConfig({ url: empty, viewer: VIEWER_CONFIG }),
    ).toEqual(VIEWER_CONFIG);
  });
});

describe("columnsForWidth", () => {
  test("picks the last breakpoint whose minWidth is <= width", () => {
    expect(columnsForWidth(DEFAULT_BOOKSHELF_CONFIG, 0)).toBe(3);
    expect(columnsForWidth(DEFAULT_BOOKSHELF_CONFIG, 700)).toBe(4);
    expect(columnsForWidth(DEFAULT_BOOKSHELF_CONFIG, 768)).toBe(5);
    expect(columnsForWidth(DEFAULT_BOOKSHELF_CONFIG, 4000)).toBe(8);
  });

  test("widths below the first breakpoint use the first breakpoint", () => {
    const config: BookshelfViewConfig = {
      breakpoints: [{ minWidthPx: 320, columns: 2 }],
      showTitle: true,
    };
    expect(columnsForWidth(config, 100)).toBe(2);
  });
});

describe("coverAspectRatioForLibraryKind", () => {
  test("returns the per-kind cover ratio for library kinds", () => {
    expect(coverAspectRatioForLibraryKind("book")).toBe(BOOK_ASPECT_RATIO);
    expect(coverAspectRatioForLibraryKind("game")).toBe(GAME_ASPECT_RATIO);
  });

  test("non-library kinds fall back to the book ratio", () => {
    expect(coverAspectRatioForLibraryKind("review")).toBe(BOOK_ASPECT_RATIO);
  });
});

describe("applyReadableFilter (mixed-content shelf)", () => {
  const items = [
    { kind: "book", isLicensed: true },
    { kind: "book", isLicensed: false },
    { kind: "game" },
    { kind: "media" },
  ];

  test("disabled keeps every item", () => {
    expect(applyReadableFilter(items, false)).toHaveLength(4);
  });

  test("enabled drops only unlicensed books; game/media unaffected", () => {
    const result = applyReadableFilter(items, true);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.kind)).toEqual(["book", "game", "media"]);
  });
});
