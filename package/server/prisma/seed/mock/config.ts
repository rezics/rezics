import type { SeedCounts } from "./types.js";

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const v = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(v) ? v : fallback;
}

export const DEFAULT_COUNTS: SeedCounts = {
  users: envInt("SEED_USERS", 200),
  tags: envInt("SEED_TAGS", 400),
  books: envInt("SEED_BOOKS", 100),
  games: envInt("SEED_GAMES", 50),
  media: envInt("SEED_MEDIA", 50),
  reviewsPerWork: envInt("SEED_REVIEWS_PER_WORK", 10),
  treePostsPerWork: envInt("SEED_TREE_POSTS_PER_WORK", 15),
  quotesPerWork: envInt("SEED_QUOTES_PER_WORK", 5),
  remarksPerWork: envInt("SEED_REMARKS_PER_WORK", 3),
  shelves: envInt("SEED_SHELVES", 100),
  realms: envInt("SEED_REALMS", 20),
  chaptersPerBook: envInt("SEED_CHAPTERS_PER_BOOK", 30),
  people: envInt("SEED_PEOPLE", 300),
  organizations: envInt("SEED_ORGANIZATIONS", 50),
  followsPerUser: envInt("SEED_FOLLOWS_PER_USER", 5),
  bookmarksPerUser: envInt("SEED_BOOKMARKS_PER_USER", 8),
};
