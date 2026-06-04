// Types only used in server for Tag (scored UnitTag system)

import type { Unit, UnitTag, UnitTranslation } from "../db/schema";

/**
 * A tag Unit with its translations.
 * Tags are Units with type=TAG, isLanguageNeutral=true.
 */
export type TagWithTranslations = typeof Unit.$inferSelect & {
  translations: Array<typeof UnitTranslation.$inferSelect>;
};

/**
 * A UnitTag junction row with the tag Unit and its translations resolved.
 */
export type UnitTagWithRelations = typeof UnitTag.$inferSelect & {
  tag: typeof Unit.$inferSelect & {
    translations: Array<typeof UnitTranslation.$inferSelect>;
  };
};

/**
 * Relation payload shape for fetching a tag Unit with translations.
 */
export const tagUnitInclude = {
  translations: true,
} as const;

/**
 * Relation payload shape for fetching UnitTag rows with tag labels.
 */
export const unitTagInclude = {
  tag: {
    include: { translations: true },
  },
} as const;
