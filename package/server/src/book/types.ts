// Type only used in server, otherwise use contract

import {
  type PublicUserSelected,
  publicUserSelect,
} from "@/utils/sanitizeUser";
import type {
  Book,
  CreditAttribution,
  Entity,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";

/**
 * Relation shape mirrored by book hydration.
 */
export const bookInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      supportLanguages: true,
      creditAttributions: {
        include: {
          entity: {
            include: { entity: true, translations: true },
          },
        },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
} as const;

/**
 * Internal book type with relations
 */
export type BookWithRelations = typeof Book.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
    creditAttributions: Array<
      typeof CreditAttribution.$inferSelect & {
        entity: typeof Unit.$inferSelect & {
          entity?: typeof Entity.$inferSelect | null;
          translations: Array<typeof UnitTranslation.$inferSelect>;
        };
      }
    >;
  };
};
