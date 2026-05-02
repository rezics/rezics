// MOCK: Storybook tag fixtures.
export interface TagFixture {
  unitId: string;
  name: string;
  slug: string;
  count: number;
}

export const tagFiction: TagFixture = {
  unitId: "tag-fiction",
  name: "Fiction",
  slug: "fiction",
  count: 1840,
};

export const tagPoetry: TagFixture = {
  unitId: "tag-poetry",
  name: "Poetry",
  slug: "poetry",
  count: 412,
};

export const tagEssay: TagFixture = {
  unitId: "tag-essay",
  name: "Essay",
  slug: "essay",
  count: 689,
};

export const tagTranslation: TagFixture = {
  unitId: "tag-translation",
  name: "Translation",
  slug: "translation",
  count: 233,
};

export const tagShortList: TagFixture[] = [tagFiction, tagPoetry, tagEssay];

export const tagLongList: TagFixture[] = [
  tagFiction,
  tagPoetry,
  tagEssay,
  tagTranslation,
  { unitId: "tag-history", name: "History", slug: "history", count: 311 },
  { unitId: "tag-memoir", name: "Memoir", slug: "memoir", count: 198 },
  { unitId: "tag-philosophy", name: "Philosophy", slug: "philosophy", count: 142 },
  { unitId: "tag-criticism", name: "Criticism", slug: "criticism", count: 88 },
];
