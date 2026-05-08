import type { UserDTO } from "../user";

/**
 * Shape of a user document stored in the Meilisearch `users` index.
 * UserType removed — no more AUTHOR/PRESS/PRODUCER distinction.
 */
export interface UserSearchDocument {
  id: string;
  userId: string;
  name: string;
  email?: string;
  slug?: string | null;
  avatar?: string | null;
  bio?: string | null;
  description?: string | null;
  followersCount?: number | null;
  followingsCount?: number | null;
  joinDate?: string | Date | null;
  permission?: UserDTO["permission"];
}

export interface UserSearchResult {
  users: UserSearchDocument[];
  total: number;
  processingTimeMs: number;
  query: string;
}
