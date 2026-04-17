import type { SeedCounts } from "./types.js";

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const v = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(v) ? v : fallback;
}

export const DEFAULT_COUNTS: SeedCounts = {
  users: envInt("SEED_USERS", 200),
  tags: envInt("SEED_TAGS", 400),
  books: envInt("SEED_BOOKS", 1000),
  games: envInt("SEED_GAMES", 1000),
  media: envInt("SEED_MEDIA", 1000),
  shelves: envInt("SEED_SHELVES", 500),
  realms: envInt("SEED_REALMS", 20),
  zones: envInt("SEED_ZONES", 40),
  personEntities: envInt("SEED_PERSON_ENTITIES", 800),
  organizationEntities: envInt("SEED_ORGANIZATION_ENTITIES", 200),
  followsPerUser: envInt("SEED_FOLLOWS_PER_USER", 5),
  bookmarksPerUser: envInt("SEED_BOOKMARKS_PER_USER", 8),
};
