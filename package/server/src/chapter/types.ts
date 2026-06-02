import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

/**
 * Chapter is a Post(kind=CHAPTER) backed by Unit(type=POST).
 * Title and cover live in UnitTranslation (cover under extra.coverUrl).
 * Content lives in ContentTranslation. Order lives in ContentStructure.
 */
export const chapterPostInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      contentTranslations: true,
      supportLanguages: true,
    },
  },
} satisfies Prisma.PostInclude;

export type ChapterPostWithRelations = Prisma.PostGetPayload<{
  include: typeof chapterPostInclude;
}>;
