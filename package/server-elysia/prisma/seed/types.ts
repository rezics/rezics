import type {UnitType} from '../generated/client.js';

/**
 * User data returned after creation
 */
export interface CreatedUser {
  unitId: string;
  name: string;
}

/**
 * Unit data returned after creation
 */
export interface CreatedUnit {
  id: string;
  type: UnitType;
}

/**
 * Configuration for seeding counts
 */
export interface SeedCounts {
  users: number;
  tags: number;
  books: number;
  otherPosts: number;
  comments: number;
}
