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
    items: [],
    translations: [
      {
        unitId: overrides.unitId,
        language: LANGUAGES.EN,
        title: "Reading queue",
        description: "Books I want to read by year-end.",
      },
    ],
    reactionSummaries: [],
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
  items: [
    { shelfUnitId: "shelf-few", unitId: "book-1", sortOrder: 0 } as never,
    { shelfUnitId: "shelf-few", unitId: "book-2", sortOrder: 1 } as never,
    { shelfUnitId: "shelf-few", unitId: "book-3", sortOrder: 2 } as never,
  ],
});

export const shelfMany: ShelfDTO = makeShelf({
  unitId: "shelf-many",
  items: Array.from({ length: 24 }, (_, index) => ({
    shelfUnitId: "shelf-many",
    unitId: `book-${index}`,
    sortOrder: index,
  })) as never,
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
