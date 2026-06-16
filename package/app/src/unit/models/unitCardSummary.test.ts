import { describe, expect, test } from "bun:test";
import {
  type BookDTO,
  markdownContentDoc,
  type PostDTO,
  type ShelfItemDTO,
  type UnitDTO,
} from "@rezics/contract";
import {
  candidateToUnitCardSummary,
  shelfItemToUnitCardSummary,
  unitDtoToUnitCardSummary,
} from "./unitCardSummary";

describe("unitDtoToUnitCardSummary", () => {
  test("maps translation fields, image, author, added time, and metadata", () => {
    const unit: UnitDTO = {
      id: "unit-1",
      type: "BOOK",
      user: { unitId: "user-1", name: "Mina" },
      supportLanguages: [
        { unitId: "unit-1", language: "en", isPrimary: true, sortOrder: 0 },
      ],
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
      author: { unitId: "user-1", name: "Mina" },
      addedAt: "2026-01-02T03:04:05.000Z",
      translationMeta: {
        language: "en",
        sourceTitle: "Source title",
        overrideTitle: "Override title",
      },
    });
  });

  test("marks rezics-wiki owned units as community catalog content", () => {
    const summary = unitDtoToUnitCardSummary({
      id: "book-1",
      type: "BOOK",
      user: {
        unitId: "rezics-wiki-unit",
        name: "rezics-wiki",
        slug: "rezics-wiki",
      } as never,
      translations: [{ unitId: "book-1", language: "en", title: "Wiki Book" }],
    });

    expect(summary).toMatchObject({
      unitId: "book-1",
      title: "Wiki Book",
      isCommunityCatalog: true,
    });
  });

  test("does not fall through to translations after a resolved language is chosen", () => {
    const summary = unitDtoToUnitCardSummary({
      id: "book-1",
      type: "BOOK",
      resolvedLanguage: "ja",
      title: null,
      translations: [{ unitId: "book-1", language: "en", title: "English" }],
    });

    expect(summary).toMatchObject({
      unitId: "book-1",
      title: "book-1",
      translationMeta: { language: "ja" },
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

function makeShelfItem(overrides: Partial<ShelfItemDTO>): ShelfItemDTO {
  return {
    shelfId: "shelf-1",
    itemType: "unit",
    itemId: "u-1",
    kind: "book",
    position: "a",
    createdAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("shelfItemToUnitCardSummary", () => {
  test("maps a hydrated shelf book unit with shelf added time", () => {
    const unit = makeShelfItem({
      itemId: "book-1",
      kind: "book",
    });
    const book: BookDTO = {
      unitId: "book-1",
      resolvedLanguage: "en",
      title: "Shelf Book",
      description: markdownContentDoc("Book description"),
      coverUrl: null,
      translations: [
        {
          unitId: "book-1",
          language: "en",
          title: "Shelf Book",
          description: markdownContentDoc("Book description"),
        },
      ],
    } as BookDTO;

    const summary = shelfItemToUnitCardSummary(unit, book);

    expect(summary).toMatchObject({
      unitId: "book-1",
      kind: "book",
      title: "Shelf Book",
      contentPreview: "Book description",
      addedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(summary.variantContext).toBeUndefined();
  });

  test("attachmentCounts is forwarded when provided", () => {
    const unit = makeShelfItem({ itemId: "book-1", kind: "book" });
    const book = {
      unitId: "book-1",
      resolvedLanguage: "en",
      title: "Shelf Book",
      coverUrl: null,
      translations: [{ unitId: "book-1", language: "en", title: "Shelf Book" }],
    } as BookDTO;

    const summary = shelfItemToUnitCardSummary(unit, book, undefined, {
      reviews: 3,
      tags: 2,
    });

    expect(summary.attachmentCounts).toEqual({ reviews: 3, tags: 2 });
  });

  test("omits attachmentCounts when none provided", () => {
    const unit = makeShelfItem({ itemId: "book-1", kind: "book" });
    const book = {
      unitId: "book-1",
      resolvedLanguage: "en",
      title: "Bare Book",
      coverUrl: null,
      translations: [{ unitId: "book-1", language: "en", title: "Bare Book" }],
    } as BookDTO;

    const summary = shelfItemToUnitCardSummary(unit, book);

    expect(summary.attachmentCounts).toBeUndefined();
  });

  test("maps a review shelf unit using resolved post title and content", () => {
    const unit = makeShelfItem({ itemId: "review-1", kind: "review" });
    const review: PostDTO = {
      unitId: "review-1",
      authorUserId: "user-1",
      author: { unitId: "user-1", name: "Reviewer" },
      title: "Review title",
      content: markdownContentDoc("Review body"),
      extra: {},
    };

    const summary = shelfItemToUnitCardSummary(unit, review);

    expect(summary).toMatchObject({
      unitId: "review-1",
      kind: "review",
      title: "Review title",
      contentPreview: "Review body",
      addedAt: "2026-02-01T00:00:00.000Z",
      author: { unitId: "user-1", name: "Reviewer" },
    });
  });

  test("unhydrated shelf unit falls back to unitId as title", () => {
    const unit = makeShelfItem({ itemId: "book-x", kind: "book" });

    const summary = shelfItemToUnitCardSummary(unit, undefined);

    expect(summary).toMatchObject({
      unitId: "book-x",
      kind: "book",
      title: "book-x",
      addedAt: "2026-02-01T00:00:00.000Z",
    });
  });
});
