import { mock } from "bun:test";

export const PostKind = {
  POST: "POST",
  REVIEW: "REVIEW",
  REMARK: "REMARK",
  EXCERPT: "EXCERPT",
  CHAPTER: "CHAPTER",
} as const;

export const UnitStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  DELETED: "DELETED",
} as const;

export const UnitType = {
  BOOK: "BOOK",
  GAME: "GAME",
  MEDIA: "MEDIA",
  POST: "POST",
  TAG: "TAG",
  REALM: "REALM",
  SHELF: "SHELF",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  QUOTE: "QUOTE",
  LINK: "LINK",
  ENTITY: "ENTITY",
  ZONE: "ZONE",
} as const;

export const UnitAliasStatus = {
  ACTIVE: "ACTIVE",
  HIDDEN: "HIDDEN",
} as const;

export const UnitVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;

export const UnitWorkDisplayPolicy = {
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY",
  HIDDEN_BY_DEFAULT: "HIDDEN_BY_DEFAULT",
} as const;

export const UnitWorkRole = {
  RELEASE: "RELEASE",
  POST: "POST",
  REVIEW: "REVIEW",
  SHELF: "SHELF",
  WIKI: "WIKI",
  GUIDE: "GUIDE",
  DERIVED: "DERIVED",
} as const;

export const UserUnitProgressStatus = {
  BACKLOG: "BACKLOG",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;

export const Prisma = {};

export const prismaMock: Record<string, any> = {};

export const prismaClientMock = {
  prisma: prismaMock,
  Prisma,
  PostKind,
  UnitStatus,
  UnitAliasStatus,
  UnitType,
  UnitVisibility,
  UnitWorkDisplayPolicy,
  UnitWorkRole,
  UserUnitProgressStatus,
};

export function installPrismaClientMock(): void {
  mock.module("#/prisma/client", () => prismaClientMock);
  mock.module("../../prisma/client", () => prismaClientMock);
}
