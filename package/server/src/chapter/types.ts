import type {
  ContentTranslation,
  Post,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import { publicUserSelect } from "@/utils/sanitizeUser";
import type { PublicUserSelected } from "@/utils/sanitizeUser";

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
} as const;

export type ChapterPostWithRelations = typeof Post.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    contentTranslations: Array<typeof ContentTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
  };
};
