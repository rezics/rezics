export const contentTranslationKeys = {
  all: () => ["content-translations"] as const,
  unit: (unitId: string) =>
    [...contentTranslationKeys.all(), "unit", unitId] as const,
  detail: (unitId: string, language: string) =>
    [...contentTranslationKeys.unit(unitId), language] as const,
};
