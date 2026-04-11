import type { PostKind, UnitType } from "#/prisma/generated/client.js";

export interface CreatedUser {
  unitId: string;
  name: string;
  slug: string;
}

export interface CreatedUnit {
  id: string;
  type: UnitType;
}

export interface CreatedPerson {
  id: string;
  name: string;
}

export interface CreatedOrganization {
  id: string;
  name: string;
}

export interface CreatedPost extends CreatedUnit {
  kind: PostKind;
  targetUnitId?: string;
}

export interface SeedCounts {
  users: number;
  tags: number;
  books: number;
  games: number;
  media: number;
  reviewsPerWork: number;
  commentsPerWork: number;
  quotesPerWork: number;
  remarksPerWork: number;
  shelves: number;
  realms: number;
  chaptersPerBook: number;
  people: number;
  organizations: number;
  followsPerUser: number;
  bookmarksPerUser: number;
}
