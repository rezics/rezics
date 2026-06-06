import type { UnitAlias } from "../db/schema";

export type UnitAliasWithVotes = typeof UnitAlias.$inferSelect & {
  votes?: { aliasId: string; userId: string; value: number }[];
};

export const unitAliasInclude = {
  votes: true,
} as const;
