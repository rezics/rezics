// Type only used in server, otherwise use contract

import type { Unit, UnitSupportLanguage, UnitTranslation } from "../db/schema";
import {
  publicUserSelect,
  type PublicUserSelected,
} from "@/utils/sanitizeUser";

/**
 * Prisma include for unit relations
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
