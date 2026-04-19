export const SEED_TAG_NAMES = [
  "book",
  "game",
  "media",
  "post",
  "link",
] as const;

export type SeedTagName = (typeof SEED_TAG_NAMES)[number];

export const SEED_TAG_TITLES: Record<SeedTagName, string> = {
  book: "Book",
  game: "Game",
  media: "Media",
  post: "Post",
  link: "Link",
};

export const SEED_TAG_SLUGS: Record<SeedTagName, string> = {
  book: "book",
  game: "game",
  media: "media",
  post: "post",
  link: "link",
};

export const SEED_TAG_SCORE = 1000;
