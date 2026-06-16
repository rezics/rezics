import { DEFAULT_LANGUAGE } from "@rezics/contract";

// MOCK: book list data using new BookDTO shape with translations
// MOCK：采用新的 BookDTO 结构并包含 translations 的图书列表数据。
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
    creditAttributions: [{ entityId: "a1", name: "Author A", role: "author" }],
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
    creditAttributions: [{ entityId: "a2", name: "Author B", role: "author" }],
    tags: [],
    coverUrl: null,
    isbn13: null,
  },
];
