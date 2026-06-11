import type { Language, UnitExternalRefDTO } from "@rezics/contract";

export function sourceSiteLabel(
  ref: UnitExternalRefDTO,
  languages: readonly Language[],
): string {
  const sourceSite = ref.sourceSite;
  const translations = sourceSite?.entity?.translations ?? [];
  for (const language of languages) {
    const title = translations.find(
      (translation) => translation.language === language,
    )?.title;
    if (title) return title;
  }
  return (
    translations.find((translation) => translation.title)?.title ??
    sourceSite?.key ??
    ref.sourceSiteEntityUnitId
  );
}
