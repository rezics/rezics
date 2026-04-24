import type {
  PinboardEntryDetailDTO,
  PinboardEntryDTO,
  PinboardKey,
} from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";
import type { PinboardUnitRow } from "./pinboard.types";

/**
 * Resolve the best UnitTranslation on a unit for a given requested/default
 * language. Precedence: requested → unit default → platform fallback `en`
 * → first available.
 */
export function resolveTranslationInline(
  unit: PinboardUnitRow,
  requestedLanguage: string | undefined,
): PinboardUnitRow["translations"][number] | null {
  const translations = unit.translations;
  if (translations.length === 0) return null;

  const byLang = new Map(translations.map((tr) => [tr.language, tr]));

  if (requestedLanguage && byLang.has(requestedLanguage)) {
    return byLang.get(requestedLanguage)!;
  }

  if (unit.defaultLanguage && byLang.has(unit.defaultLanguage)) {
    return byLang.get(unit.defaultLanguage)!;
  }

  if (byLang.has(FALLBACK_LANGUAGE)) return byLang.get(FALLBACK_LANGUAGE)!;

  const sorted = [...translations].sort((a, b) =>
    a.language.localeCompare(b.language),
  );
  return sorted[0] ?? null;
}

export function mapPinboardEntryDTO(
  unit: PinboardUnitRow,
  options: {
    realmUnitId: string;
    pinboardKey: PinboardKey;
    position: number;
    requestedLanguage?: string;
  },
): PinboardEntryDTO {
  const resolved = resolveTranslationInline(unit, options.requestedLanguage);
  const supported = unit.translationGroup?.supportedLanguages ?? [
    unit.defaultLanguage ?? FALLBACK_LANGUAGE,
  ];

  return {
    unitId: unit.id,
    pinboardKey: options.pinboardKey,
    realmUnitId: options.realmUnitId,
    authorUserId: unit.post?.authorUserId ?? unit.userId ?? null,
    title: resolved?.title ?? null,
    summary: resolved?.summary ?? null,
    language: resolved?.language ?? unit.defaultLanguage ?? FALLBACK_LANGUAGE,
    defaultLanguage: unit.defaultLanguage ?? null,
    supportedLanguages: supported,
    position: options.position,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

export function mapPinboardEntryDetailDTO(
  rootUnit: PinboardUnitRow,
  resolvedUnit: PinboardUnitRow,
  options: {
    realmUnitId: string;
    pinboardKey: PinboardKey;
    requestedLanguage?: string;
  },
): PinboardEntryDetailDTO {
  const resolved = resolveTranslationInline(
    resolvedUnit,
    options.requestedLanguage,
  );
  const supported = rootUnit.translationGroup?.supportedLanguages ?? [
    rootUnit.defaultLanguage ?? FALLBACK_LANGUAGE,
  ];

  return {
    unitId: rootUnit.id,
    pinboardKey: options.pinboardKey,
    realmUnitId: options.realmUnitId,
    authorUserId: rootUnit.post?.authorUserId ?? rootUnit.userId ?? null,
    title: resolved?.title ?? null,
    subtitle: resolved?.subtitle ?? null,
    summary: resolved?.summary ?? null,
    description: resolved?.description ?? null,
    body: resolvedUnit.post?.body ?? null,
    language:
      resolved?.language ??
      resolvedUnit.defaultLanguage ??
      rootUnit.defaultLanguage ??
      FALLBACK_LANGUAGE,
    defaultLanguage: rootUnit.defaultLanguage ?? null,
    supportedLanguages: supported,
    resolvedUnitId: resolvedUnit.id,
    createdAt: rootUnit.createdAt,
    updatedAt: rootUnit.updatedAt,
  };
}
