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

/**
 * Deterministic fractional-indexing-style position keys for seed-installed
 * UnitTag rows. Prefixed with `!` so they sort lexicographically before any
 * base62 key produced by the `fractional-indexing` library (which starts at
 * digits/letters). Order across seeds is fixed by SEED_TAG_NAMES.
 */
export const SEED_TAG_POSITIONS: Record<SeedTagName, string> = {
  book: "!a0",
  game: "!a1",
  media: "!a2",
  post: "!a3",
  link: "!a4",
};

/**
 * Platform-reserved tag slug marking a post as an issue (the issue lifecycle
 * schema's key), the issue-genre counterpart to `OFFICIAL_QUESTION_TAG_SLUG`.
 * Reserved/official like the seed tags; need not be seeded (state rendering
 * falls back to the raw slug when no tag exists). See `post-state-schema.ts`.
 */
export const OFFICIAL_ISSUE_TAG_SLUG = "issue";
