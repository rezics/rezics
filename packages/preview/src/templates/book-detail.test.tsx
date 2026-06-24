/** @jsxImportSource @kitajs/html */
import { describe, expect, test } from "bun:test";
import type { BookDTO } from "@rezics/contract";
import { markdownContentDoc } from "@rezics/contract";
import { BookDetailTemplate } from "./book-detail";
import { notFoundHtml } from "./not-found";

function book(overrides: Partial<BookDTO> = {}): BookDTO {
  return {
    unitId: "book-1",
    defaultLanguage: "en",
    coverUrl: "/covers/book.jpg",
    translations: [
      {
        language: "en",
        title: "A <Dangerous> Book",
        summary: "Summary text",
        description: markdownContentDoc("Description from markdown"),
      },
    ],
    ...overrides,
  } as BookDTO;
}

describe("BookDetailTemplate", () => {
  test("escapes dynamic title text and emits canonical/OG metadata", () => {
    const html = String(
      BookDetailTemplate({
        book: book(),
        canonicalUrl: "https://rezics.example/book/book-1",
        origin: "https://rezics.example",
      }),
    );

    expect(html).toContain("A &lt;Dangerous&gt; Book");
    expect(html).not.toContain("<Dangerous>");
    expect(html).toContain(
      '<link rel="canonical" href="https://rezics.example/book/book-1"',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://rezics.example/covers/book.jpg"',
    );
    expect(html).toContain("Description from markdown");
  });

  test("falls back to summary card metadata without an image", () => {
    const html = String(
      BookDetailTemplate({
        book: book({ coverUrl: null }),
        canonicalUrl: "https://rezics.example/book/book-1",
        origin: "https://rezics.example",
      }),
    );

    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).not.toContain("og:image");
  });

  test("returns simple bot-readable 404 HTML", () => {
    expect(notFoundHtml()).toBe(
      "<!doctype html><title>Not Found</title>Not Found",
    );
  });
});
