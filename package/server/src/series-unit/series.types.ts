import type {
  Series,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import { publicUserSelect } from "@/utils/sanitizeUser";
import type { PublicUserSelected } from "@/utils/sanitizeUser";

export const seriesInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      supportLanguages: true,
    },
  },
  _count: {
    select: { directReleaseIndexRows: true },
  },
} as const;

export type SeriesWithRelations = typeof Series.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
  };
  _count?: { directReleaseIndexRows: number };
};

export const seriesOrderBy = [
  { updatedAt: "desc" as const },
  { unitId: "asc" as const },
] as const;
