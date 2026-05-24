import type { Prisma, UnitAlias } from "#/prisma/client";

export type UnitAliasWithVotes = UnitAlias & {
  votes?: { aliasId: string; userId: string; value: number }[];
};

export const unitAliasInclude = {
  votes: true,
} satisfies Prisma.UnitAliasInclude;
