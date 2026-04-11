// MOCK: book list data using new BookDTO shape with translations
export const bookList01 = [
  {
    unitId: "1",
    translations: [
      {
        unitId: "1",
        language: "zh-CN",
        title: "Mock Book 1",
        description: "Mock Description 1",
      },
    ],
    personCredits: [
      { personId: "a1", name: "Author A", roleKey: "author" },
    ],
    orgCredits: [],
    tags: [],
    coverAssetUnitId: null,
    isbn13: null,
  },
  {
    unitId: "2",
    translations: [
      {
        unitId: "2",
        language: "zh-CN",
        title: "Mock Book 2",
        description: "Mock Description 2",
      },
    ],
    personCredits: [
      { personId: "a2", name: "Author B", roleKey: "author" },
    ],
    orgCredits: [],
    tags: [],
    coverAssetUnitId: null,
    isbn13: null,
  },
];
