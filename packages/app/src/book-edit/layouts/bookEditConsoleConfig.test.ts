import { describe, expect, test } from "bun:test";
import {
  createBookEditConsoleConfig,
  getBookEditChapterContextId,
} from "./bookEditConsoleConfig";

describe("book edit console configuration", () => {
  test("provides return, primary, and operational navigation in console order", () => {
    const config = createBookEditConsoleConfig("book-1");

    expect(config.returnItem.href).toBe("/book/book-1");
    expect(config.primaryItems.map((item) => item.href)).toEqual([
      "/book/book-1/edit",
      "/book/book-1/edit/tag",
      "/book/book-1/edit/chapter",
    ]);
    expect(config.operationalItems?.map((item) => item.href)).toEqual([
      "/book/book-1/edit/authority",
      "/book/book-1/edit/history",
    ]);
  });

  test("marks chapter edit routes as chapter context without replacing book navigation", () => {
    const config = createBookEditConsoleConfig("book-1");
    const chaptersItem = config.primaryItems.find((item) =>
      item.href.endsWith("/chapter"),
    );

    expect(
      getBookEditChapterContextId("/book/book-1/edit/chapter-1", "book-1"),
    ).toBe("chapter-1");
    expect(chaptersItem?.isActive?.("/book/book-1/edit/chapter-1")).toBe(true);
  });

  test("does not create lower context for non-chapter edit routes", () => {
    expect(getBookEditChapterContextId("/book/book-1/edit", "book-1")).toBe(
      null,
    );
    expect(getBookEditChapterContextId("/book/book-1/edit/tag", "book-1")).toBe(
      null,
    );
    expect(
      getBookEditChapterContextId(
        "/book/book-1/edit/history/compare/3",
        "book-1",
      ),
    ).toBe(null);
  });
});
