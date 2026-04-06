import type { UserDTO } from "../user";

/**
 * Shape of a user document stored in the Meilisearch `users` index.
 *
 * - Keeps a denormalized copy of the public user profile for fast listing.
 * - Email is stored for admin/token queries but can be omitted in public APIs.
 */
export interface UserSearchDocument {
  /** Primary key in Meilisearch (mirrors unitId). */
  id: string;

  // Core identity
  unitId: string;
  name: string;

  // Optional profile fields
  email?: string;
  slug?: string | null;
  type?: string | null;
  avatar?: string | null;
  bio?: string | null;
  description?: string | null;

  // Stats & metadata
  followersCount?: number | null;
  followingsCount?: number | null;
  joinDate?: string | Date | null;

  /**
   * Raw permission object (role etc.).
   * Stored as-is so that admin/token flows can reconstruct a UserDTO.
   */
  permission?: UserDTO["permission"];
}

/**
 * Normalized search result for user queries.
 */
export interface UserSearchResult {
  /** Hits for the current page. */
  users: UserSearchDocument[];
  /** Total number of matched hits. */
  total: number;
  /** Meilisearch processing time in milliseconds. */
  processingTimeMs: number;
  /** Final query string actually sent to Meilisearch. */
  query: string;
}
