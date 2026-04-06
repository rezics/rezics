import type { Prisma, Tag, Unit, User } from "#/prisma/client";

export type ChapterUnitWithRelations = Unit & {
  user?: User;
  tags?: Tag[];
};

export const chapterUnitInclude = {
  user: true,
  tags: true,
} satisfies Prisma.UnitInclude;
