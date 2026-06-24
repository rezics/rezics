import type { Entity, Unit, UnitTranslation } from "../db/schema";

/**
 * Include shape for hydrating an Entity row with everything the mapper needs:
 * the parent Unit (for slug, status, visibility, userId, timestamps) and the
 * Unit's translations (for the DTO's `translations` array).
 */
export const entityInclude = {
  unit: {
    include: {
      translations: true,
    },
  },
} as const;

export type EntityWithRelations = typeof Entity.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    translations?: Array<typeof UnitTranslation.$inferSelect>;
  };
};
