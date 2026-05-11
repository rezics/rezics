import { describe, expect, test } from "bun:test";
import type { BookDTO, PostDTO, ShelfItemDTO, UnitDTO } from "@rezics/contract";
import {
  candidateToUnitCardSummary,
  resolveUnitWorkContext,
  shelfEntryToUnitCardSummary,
  unitDtoToUnitCardSummary,
} from "./unitCardSummary";

describe("unitDtoToUnitCardSummary", () => {
  test("maps translation fields, image, author, added time, and metadata", () => {
    const unit: UnitDTO = {
      id: "unit-1",
      type: "BOOK",
      user: { userId: "user-1", name: "Mina" },
      defaultLanguage: "en",
      translations: [
        {
          unitId: "unit-1",
          language: "en",
          title: "Display title",
          subtitle: "Subtitle",
          summary: "Short summary",
          extra: {
            coverUrl: "https://example.test/cover.jpg",
            sourceTitle: "Source title",
            overrideTitle: "Override title",
          },
        },
      ],
    };

    const summary = unitDtoToUnitCardSummary(unit, {
      addedAt: "2026-01-02T03:04:05.000Z",
    });

    expect(summary).toMatchObject({
      unitId: "unit-1",
      kind: "book",
      title: "Display title",
      subtitle: "Subtitle",
      imageUrl: "https://example.test/cover.jpg",
      contentPreview: "Short summary",
      author: { userId: "user-1", name: "Mina" },
      addedAt: "2026-01-02T03:04:05.000Z",
      translationMeta: {
        language: "en",
        sourceTitle: "Source title",
        overrideTitle: "Override title",
      },
    });
  });

  test("falls back to identifier data for unresolved candidates", () => {
    const summary = candidateToUnitCardSummary({
      kind: "book",
      identifier: "book-1",
      identifierType: "id",
    });

    expect(summary).toMatchObject({
      unitId: "book-1",
      kind: "book",
      title: "book-1",
      subtitle: "id",
    });
  });
});

describe("shelfEntryToUnitCardSummary", () => {
  test("maps a hydrated shelf book entry with shelf added time", () => {
    const item: ShelfItemDTO = {
      shelfUnitId: "shelf-1",
      itemRef: "book-1",
      kind: "book",
      position: "a",
      reviewIds: [],
      tagIds: [],
      createdAt: "2026-02-01T00:00:00.000Z",
    };
    const book: BookDTO = {
      unitId: "book-1",
      coverUrl: null,
      translations: [
        {
          unitId: "book-1",
          language: "en",
          title: "Shelf Book",
          description: "Book description",
        },
      ],
    } as BookDTO;

    const summary = shelfEntryToUnitCardSummary({
      kind: "prime",
      enriched: { item, primary: book },
    });

    expect(summary).toMatchObject({
      unitId: "book-1",
      kind: "book",
      title: "Shelf Book",
      contentPreview: "Book description",
      addedAt: "2026-02-01T00:00:00.000Z",
    });
  });

  test("maps attached review entries from parent shelf metadata", () => {
    const parentItem = {
      shelfUnitId: "shelf-1",
      itemRef: "book-1",
      kind: "book",
      position: "a",
      reviewIds: ["review-1"],
      tagIds: [],
      createdAt: "2026-02-01T00:00:00.000Z",
    } satisfies ShelfItemDTO;
    const review: PostDTO = {
      unitId: "review-1",
      authorUserId: "user-1",
      author: { userId: "user-1", name: "Reviewer" },
      body: "Review body",
      extra: { title: "Review title" },
    };

    const summary = shelfEntryToUnitCardSummary({
      kind: "review",
      parentItem,
      review,
    });

    expect(summary).toMatchObject({
      unitId: "review-1",
      kind: "review",
      title: "Review title",
      contentPreview: "Review body",
      addedAt: "2026-02-01T00:00:00.000Z",
      author: { userId: "user-1", name: "Reviewer" },
    });
  });
});

describe("resolveUnitWorkContext", () => {
  test("uses a release's workUnitId when present", () => {
    expect(
      resolveUnitWorkContext(
        { kind: "chapter", identifier: "chapter-1" },
        { id: "chapter-1", type: "POST", workUnitId: "book-1" },
      ),
    ).toEqual({ unitId: "book-1", title: "chapter-1" });
  });

  test("uses work-like candidate ids directly", () => {
    expect(
      resolveUnitWorkContext({ kind: "book", identifier: "book-1" }),
    ).toEqual({ unitId: "book-1", title: undefined });
  });
});
