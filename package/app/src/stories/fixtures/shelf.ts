// MOCK: Storybook shelf fixtures, hand-authored against `ShelfDTO`.
import type { ShelfDTO } from "@rezics/contract";
import { LANGUAGES } from "@rezics/contract";
import { userAlice } from "./user.ts";

function makeShelf(
  overrides: Partial<ShelfDTO> & { unitId: string },
): ShelfDTO {
  return {
    unitId: overrides.unitId,
    userId: userAlice.userId,
    user: userAlice,
    coverUrl: `https://picsum.photos/seed/${overrides.unitId}/640/360`,
    units: [],
    relations: [],
    translations: [
      {
        unitId: overrides.unitId,
        language: LANGUAGES.EN,
        title: "Reading queue",
        description: "Books I want to read by year-end.",
      },
    ],
    createdAt: "2024-03-01T00:00:00.000Z",
    updatedAt: "2024-03-15T00:00:00.000Z",
    ...overrides,
  } as ShelfDTO;
}

export const shelfEmpty: ShelfDTO = makeShelf({
  unitId: "shelf-empty",
  coverUrl: null,
  translations: [
    {
      unitId: "shelf-empty",
      language: LANGUAGES.EN,
      title: "Untouched shelf",
      description: "",
    },
  ],
});

export const shelfFew: ShelfDTO = makeShelf({
  unitId: "shelf-few",
  units: [
    {
      shelfId: "shelf-few",
      unitId: "book-1",
      kind: "book",
      position: "a0",
    },
    {
      shelfId: "shelf-few",
      unitId: "book-2",
      kind: "book",
      position: "a1",
    },
    {
      shelfId: "shelf-few",
      unitId: "book-3",
      kind: "book",
      position: "a2",
    },
  ],
});

export const shelfMany: ShelfDTO = makeShelf({
  unitId: "shelf-many",
  units: Array.from({ length: 24 }, (_, index) => ({
    shelfId: "shelf-many",
    unitId: `book-${index}`,
    kind: "book" as const,
    position: `a${String(index).padStart(2, "0")}`,
  })),
});

export const shelfLongDescription: ShelfDTO = makeShelf({
  unitId: "shelf-long",
  translations: [
    {
      unitId: "shelf-long",
      language: LANGUAGES.EN,
      title: "Slow reading club, year four",
      description:
        "Fifteen books selected for our annual slow-reading group: one per month with two months for re-reads. Themes this year are exile, translation, and the long form essay. Companion notes are posted in the discussion thread; suggested pairings live in the description of each item.",
    },
  ],
});

export const shelfList: ShelfDTO[] = [
  shelfFew,
  shelfMany,
  shelfLongDescription,
];
