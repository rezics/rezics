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

export interface PostsPerWorkCounts {
  reviewMax: number;
  excerptMax: number;
  remarkMax: number;
  treeMax: number;
}

export interface ChapterCounts {
  min: number;
  max: number;
  unitProbability: number;
}

export interface SeedCounts {
  users: number;
  tags: number;
  books: number;
  games: number;
  media: number;
  shelves: number;
  realms: number;
  zones: number;
  personEntities: number;
  organizationEntities: number;
  followsPerUser: number;
  favoriteItemsPerUser: number;
  postsPerWork: PostsPerWorkCounts;
  chapter: ChapterCounts;
}
