import { DEFAULT_LANGUAGE } from "@rezics/contract";

// MOCK: book list data using new BookDTO shape with translations
export const bookList01 = [
  {
    unitId: "1",
    translations: [
      {
        unitId: "1",
        language: DEFAULT_LANGUAGE,
        title: "Mock Book 1",
        description: "Mock Description 1",
      },
    ],
    attributions: [{ entityId: "a1", name: "Author A", role: "author" }],
    tags: [],
    coverUrl: null,
    isbn13: null,
  },
  {
    unitId: "2",
    translations: [
      {
        unitId: "2",
        language: DEFAULT_LANGUAGE,
        title: "Mock Book 2",
        description: "Mock Description 2",
      },
    ],
    attributions: [{ entityId: "a2", name: "Author B", role: "author" }],
    tags: [],
    coverUrl: null,
    isbn13: null,
  },
];
