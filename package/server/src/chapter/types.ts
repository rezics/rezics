import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

/**
 * Chapter is a Post(kind=CHAPTER) backed by Unit(type=POST).
 * Title and cover live in UnitTranslation (cover under extra.coverUrl).
 * Body lives in Post.body. Order lives in BookContentStructure.
 */
export const chapterPostInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
    },
  },
} satisfies Prisma.PostInclude;

export type ChapterPostWithRelations = Prisma.PostGetPayload<{
  include: typeof chapterPostInclude;
}>;
