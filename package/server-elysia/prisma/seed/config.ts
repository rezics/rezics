import type {SeedCounts} from './types.js';

/**
 * Parse environment variable as integer with fallback
 * @param name - Environment variable name
 * @param fallback - Default value if not set or invalid
 * @returns Parsed integer or fallback value
 */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const v = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Default seed counts from environment or fallback values
 */
export const DEFAULT_COUNTS: SeedCounts = {
  users: envInt('SEED_USERS', 2000),
  pressUsers: envInt('SEED_PRESS_USERS', 200),
  producerUsers: envInt('SEED_PRODUCER_USERS', 200),
  tags: envInt('SEED_TAGS', 40000),
  books: envInt('SEED_BOOKS', 500),
  otherPosts: envInt('SEED_OTHER_POSTS', 1500),
  comments: envInt('SEED_COMMENTS', 6000),
  readLists: envInt('SEED_READ_LISTS', 1000),
};
