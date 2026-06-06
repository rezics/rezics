import type { Link, Unit, UnitTranslation } from "../db/schema";

export const linkInclude = {
  unit: {
    include: {
      translations: true,
    },
  },
} as const;

export type LinkWithRelations = typeof Link.$inferSelect & {
  unit?:
    | (typeof Unit.$inferSelect & {
        translations?: Array<typeof UnitTranslation.$inferSelect>;
      })
    | null;
};
