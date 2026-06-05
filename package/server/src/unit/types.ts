// Type only used in server, otherwise use contract

import {
  type PublicUserSelected,
  publicUserSelect,
} from "@/utils/sanitizeUser";
import type { Unit, UnitSupportLanguage, UnitTranslation } from "../db/schema";

/**
 * Relation payload shape for unit reads.
 */
export const unitInclude = {
  user: { select: publicUserSelect },
  translations: true,
  supportLanguages: true,
} as const;

/**
 * Internal Unit type with relations
 */
export type UnitWithRelations = typeof Unit.$inferSelect & {
  user?: PublicUserSelected | null;
  translations: Array<typeof UnitTranslation.$inferSelect>;
  supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
};
