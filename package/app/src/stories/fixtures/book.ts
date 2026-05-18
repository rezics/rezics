// MOCK: Storybook book fixtures. Hand-authored against `BookDTO` runtime types;
// CJK + Latin variants pull from `@rezics/shared/text` to stay drift-free with
// the curated corpus that production seed data uses.
import type { BookDTO } from "@rezics/contract";
import { LANGUAGES } from "@rezics/contract";
import { getDescriptionPool, getTitlePool } from "@rezics/shared/text";

const PLACEHOLDER_COVER = "https://picsum.photos/seed/rezics-book/240/360";
const NO_COVER_PLACEHOLDER =
  "https://placehold.co/240x360/e5e7eb/6b7280?text=No+cover";

function pickFirst(pool: readonly string[], minLen = 0): string {
  for (const item of pool) {
    if (item.length >= minLen) return item;
  }
  return pool[0] ?? "";
}

function makeBook(overrides: Partial<BookDTO> & { unitId: string }): BookDTO {
  return {
    unitId: overrides.unitId,
    coverUrl: PLACEHOLDER_COVER,
    rating: "GENERAL",
    defaultLanguage: LANGUAGES.EN,
    pageCount: 320,
    publicationDate: "2024-01-15",
    createdAt: "2024-01-15T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
    publishedAt: "2024-01-15T00:00:00.000Z",
    translations: [
      {
        unitId: overrides.unitId,
        language: LANGUAGES.EN,
        title: "The Quiet Library",
        summary: "A reflection on the rooms that hold our reading lives.",
        description:
          "Across twelve essays, the narrator walks through public libraries from Tokyo to Buenos Aires, tracing how each city's reading rooms shape the books that find their way home with us.",
      },
    ],
    creditAttributions: [
      {
        entityId: "author-mei",
        name: "Mei Tanaka",
        role: "AUTHOR",
      },
    ],
    ...overrides,
  } as BookDTO;
}

export const bookEmpty: BookDTO = makeBook({
  unitId: "book-empty",
  translations: [],
  creditAttributions: [],
});

export const bookFew: BookDTO = makeBook({
  unitId: "book-few",
});

export const bookMany: BookDTO[] = Array.from({ length: 12 }, (_, i) =>
  makeBook({
    unitId: `book-many-${i}`,
    coverUrl: `https://picsum.photos/seed/rezics-book-${i}/240/360`,
    translations: [
      {
        unitId: `book-many-${i}`,
        language: LANGUAGES.EN,
        title: `Volume ${i + 1}: A Reader's Notebook`,
        summary: "Notes that grew into something larger.",
        description: "",
      },
    ],
  }),
);

export const bookLongTitle: BookDTO = makeBook({
  unitId: "book-long-title",
  translations: [
    {
      unitId: "book-long-title",
      language: LANGUAGES.EN,
      title:
        "An Astonishingly Long Title That Refuses to Compress, with a Subtitle and Several Subordinate Clauses to Test Line Clamping Behavior",
      summary:
        "Some titles arrive ready to overflow every layout the design team had in mind, and that's exactly the point of this fixture.",
      description:
        "Long-title books verify that horizontal cards truncate to one line, vertical cards wrap responsibly, and metadata panels reflow without breaking neighboring blocks.",
    },
  ],
});

export const bookNoCover: BookDTO = makeBook({
  unitId: "book-no-cover",
  coverUrl: NO_COVER_PLACEHOLDER,
});

export const bookCJK: BookDTO = makeBook({
  unitId: "book-cjk",
  defaultLanguage: LANGUAGES.ZH_HANT,
  coverUrl: "https://picsum.photos/seed/rezics-book-cjk/240/360",
  translations: [
    {
      unitId: "book-cjk",
      language: LANGUAGES.ZH_HANT,
      title: pickFirst(getTitlePool(LANGUAGES.ZH_HANT, "BOOK"), 8),
      summary: pickFirst(getDescriptionPool(LANGUAGES.ZH_HANT), 80),
      description: pickFirst(getDescriptionPool(LANGUAGES.ZH_HANT), 120),
    },
  ],
});

export const bookLatin: BookDTO = makeBook({
  unitId: "book-latin",
  defaultLanguage: LANGUAGES.EN,
  coverUrl: "https://picsum.photos/seed/rezics-book-latin/240/360",
  translations: [
    {
      unitId: "book-latin",
      language: LANGUAGES.EN,
      title: pickFirst(getTitlePool(LANGUAGES.EN, "BOOK"), 12),
      summary: pickFirst(getDescriptionPool(LANGUAGES.EN), 80),
      description: pickFirst(getDescriptionPool(LANGUAGES.EN), 120),
    },
  ],
});

export const bookCardPropsList = bookMany.map((book, index) => ({
  id: book.unitId,
  title: book.translations?.[0]?.title ?? `Book ${index + 1}`,
  author: book.creditAttributions?.[0]?.name,
  description: book.translations?.[0]?.summary,
  coverUrl: book.coverUrl ?? PLACEHOLDER_COVER,
  href: `/books/${book.unitId}`,
}));
