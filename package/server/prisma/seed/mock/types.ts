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

export interface CreatedEntity {
  unitId: string;
  name: string;
  kind: string;
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
  treePostsPerWork: number;
  quotesPerWork: number;
  remarksPerWork: number;
  shelves: number;
  realms: number;
  chaptersPerBook: number;
  personEntities: number;
  organizationEntities: number;
  followsPerUser: number;
  bookmarksPerUser: number;
}
