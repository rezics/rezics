import type {
  Entity,
  SubjectAttribution,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";

type EntityUnitWithTranslations = typeof Unit.$inferSelect & {
  entity?: typeof Entity.$inferSelect | null;
  translations: Array<typeof UnitTranslation.$inferSelect>;
};

type UnitWithLanguageRelations = typeof Unit.$inferSelect & {
  translations: Array<typeof UnitTranslation.$inferSelect>;
  supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
};

export type SubjectAttributionWithRelations =
  typeof SubjectAttribution.$inferSelect & {
    entity: EntityUnitWithTranslations;
    unit: UnitWithLanguageRelations;
  };

export const subjectAttributionInclude = {
  entity: {
    include: {
      entity: true,
      translations: true,
    },
  },
  unit: {
    include: {
      translations: true,
      supportLanguages: true,
    },
  },
} as const;
