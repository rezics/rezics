import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

export const chapterUnitInclude = {
  user: { select: publicUserSelect },
  translations: true,
} satisfies Prisma.UnitInclude;

export type ChapterUnitWithRelations = Prisma.UnitGetPayload<{
  include: typeof chapterUnitInclude;
}>;
