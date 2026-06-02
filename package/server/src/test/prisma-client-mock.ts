import { mock } from "bun:test";

export const PostKind = {
  POST: "POST",
  REVIEW: "REVIEW",
  REMARK: "REMARK",
  EXCERPT: "EXCERPT",
  CHAPTER: "CHAPTER",
  WIKI: "WIKI",
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
  COMMENT: "COMMENT",
  TAG: "TAG",
  REALM: "REALM",
  SHELF: "SHELF",
  SERIES: "SERIES",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  QUOTE: "QUOTE",
  LINK: "LINK",
  ENTITY: "ENTITY",
  ZONE: "ZONE",
  LABEL: "LABEL",
  POLL: "POLL",
} as const;

export const PollVoteMode = {
  SINGLE: "SINGLE",
  MULTI: "MULTI",
} as const;

export const PollResultVisibility = {
  LIVE: "LIVE",
  AFTER_CLOSE: "AFTER_CLOSE",
} as const;

export const UnitAliasStatus = {
  ACTIVE: "ACTIVE",
  HIDDEN: "HIDDEN",
} as const;

export const PinKind = {
  ACCEPTED_ANSWER: "ACCEPTED_ANSWER",
  PINNED: "PINNED",
  HIGHLIGHT: "HIGHLIGHT",
} as const;

export const UnitVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;

export const AiDisclosureMode = {
  UNKNOWN: "UNKNOWN",
  NONE: "NONE",
  AI_ASSISTED: "AI_ASSISTED",
  AI_ORIGINATED: "AI_ORIGINATED",
  MACHINE_GENERATED: "MACHINE_GENERATED",
} as const;

export const UserUnitProgressStatus = {
  BACKLOG: "BACKLOG",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;

// Minimal stand-ins for the raw-SQL tag helpers. The `$queryRaw`/`$executeRaw`
// mocks ignore their arguments, so these only need to not throw when the
// service composes ltree path SQL.
export const Prisma = {
  JsonNull: null,
  sql: (...args: unknown[]) => args,
  join: (...args: unknown[]) => args,
  raw: (value: unknown) => value,
  empty: undefined as unknown,
};

export const prismaMock: Record<string, any> = {};

export const prismaClientMock = {
  prisma: prismaMock,
  Prisma,
  PostKind,
  PinKind,
  PollVoteMode,
  PollResultVisibility,
  UnitStatus,
  UnitAliasStatus,
  UnitType,
  UnitVisibility,
  AiDisclosureMode,
  UserUnitProgressStatus,
};

export function installPrismaClientMock(): void {
  mock.module("#/prisma/client", () => prismaClientMock);
  mock.module("../../prisma/client", () => prismaClientMock);
}
