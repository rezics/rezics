import type { SeedCounts } from "./types.js";

export type SeedProfile = "default" | "fast";

export const PROFILE: SeedProfile =
  process.env.SEED_PROFILE === "fast" ? "fast" : "default";

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const v = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(v) ? v : fallback;
}

export function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  const v = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(v) ? v : fallback;
}

const FAST_OVERRIDES = {
  users: 30,
  tags: 50,
  books: 50,
  games: 50,
  media: 50,
  shelves: 30,
  reviewMax: 5,
  excerptMax: 3,
  remarkMax: 3,
  treeMax: 10,
  chapterMin: 3,
  chapterMax: 30,
} as const;

function profileDefault<K extends keyof typeof FAST_OVERRIDES>(
  key: K,
  fallback: number,
): number {
  return PROFILE === "fast" ? FAST_OVERRIDES[key] : fallback;
}

export const DEFAULT_COUNTS: SeedCounts = {
  users: envInt("SEED_USERS", profileDefault("users", 200)),
  tags: envInt("SEED_TAGS", profileDefault("tags", 400)),
  books: envInt("SEED_BOOKS", profileDefault("books", 1000)),
  games: envInt("SEED_GAMES", profileDefault("games", 1000)),
  media: envInt("SEED_MEDIA", profileDefault("media", 1000)),
  shelves: envInt("SEED_SHELVES", profileDefault("shelves", 500)),
  realms: envInt("SEED_REALMS", 20),
  zones: envInt("SEED_ZONES", 40),
  personEntities: envInt("SEED_PERSON_ENTITIES", 800),
  organizationEntities: envInt("SEED_ORGANIZATION_ENTITIES", 200),
  followsPerUser: envInt("SEED_FOLLOWS_PER_USER", 5),
  favoriteItemsPerUser: envInt("SEED_FAVORITE_ITEMS_PER_USER", 8),
  postsPerWork: {
    reviewMax: envInt(
      "SEED_REVIEWS_PER_WORK_MAX",
      profileDefault("reviewMax", 50),
    ),
    excerptMax: envInt(
      "SEED_EXCERPTS_PER_WORK_MAX",
      profileDefault("excerptMax", 15),
    ),
    remarkMax: envInt(
      "SEED_REMARKS_PER_WORK_MAX",
      profileDefault("remarkMax", 10),
    ),
    treeMax: envInt(
      "SEED_TREE_POSTS_PER_WORK_MAX",
      profileDefault("treeMax", 120),
    ),
  },
  chapter: {
    min: envInt("SEED_CHAPTERS_PER_BOOK_MIN", profileDefault("chapterMin", 5)),
    max: envInt(
      "SEED_CHAPTERS_PER_BOOK_MAX",
      profileDefault("chapterMax", 1200),
    ),
    unitProbability: envFloat("SEED_CHAPTER_UNIT_PROBABILITY", 0.1),
  },
};
