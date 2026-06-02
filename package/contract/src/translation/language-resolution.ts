import { t } from "elysia";
import { DEFAULT_LANGUAGE } from "../language-core";
import { languageSchema } from "../language";
import { contentDocSchema } from "../content/doc-v1";
import {
  unitSupportLanguageDTOSchema,
  unitTranslationDTOSchema,
} from "../unit/unit";
import { contentTranslationDTOSchema } from "../content/translation";

export const languageResolutionInputSchema = t.Object({
  explicitLanguage: t.Optional(languageSchema),
  preferredLanguages: t.Optional(t.Array(languageSchema)),
  appLocale: t.Optional(languageSchema),
});

export type LanguageResolutionInput =
  (typeof languageResolutionInputSchema)["static"];

export type SupportLanguageLike = {
  language: string;
  isPrimary?: boolean | null;
  sortOrder?: number | null;
};

export function primaryLanguages(
  supportLanguages: readonly SupportLanguageLike[] = [],
): string[] {
  return uniqueLanguages(
    supportLanguages
      .filter((item) => item.isPrimary)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((item) => item.language),
  );
}

export function readLanguageCandidates(input: {
  explicitLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  supportLanguages?: readonly SupportLanguageLike[] | null;
  fallbackLanguage?: string | null;
}): string[] {
  const supportLanguages = input.supportLanguages ?? [];
  const primary = supportLanguages
    .filter((item) => item.isPrimary)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const remaining = supportLanguages
    .filter((item) => !item.isPrimary)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // App locale describes UI/runtime language. User content preferences are
  // more specific and intentionally outrank it for content reads.
  return uniqueLanguages([
    input.explicitLanguage,
    ...(input.preferredLanguages ?? []),
    input.appLocale,
    ...primary.map((item) => item.language),
    ...remaining.map((item) => item.language),
    input.fallbackLanguage ?? DEFAULT_LANGUAGE,
  ]);
}

export function authoringLanguageCandidates(input: {
  explicitLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  fallbackLanguage?: string | null;
}): string[] {
  return uniqueLanguages([
    input.explicitLanguage,
    input.preferredLanguages?.[0],
    input.appLocale,
    input.fallbackLanguage ?? DEFAULT_LANGUAGE,
  ]);
}

export function resolveAuthoringLanguage(
  input: Parameters<typeof authoringLanguageCandidates>[0],
): string {
  return authoringLanguageCandidates(input)[0] ?? DEFAULT_LANGUAGE;
}

export function resolveReadLanguage(input: {
  explicitLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  supportLanguages?: readonly SupportLanguageLike[] | null;
  availableLanguages?: readonly (string | null | undefined)[] | null;
  fallbackLanguage?: string | null;
}): string | null {
  const available = uniqueLanguages(input.availableLanguages ?? []);
  if (available.length === 0) return null;
  for (const language of readLanguageCandidates(input)) {
    if (available.includes(language)) return language;
  }
  return available[0] ?? null;
}

function uniqueLanguages(
  languages: readonly (string | null | undefined)[],
): string[] {
  return [
    ...new Set(
      languages
        .map((language) => language?.trim())
        .filter((language): language is string => !!language),
    ),
  ];
}

export const unitLanguageAvailabilitySchema = t.Object({
  unitId: t.String(),
  supportLanguages: t.Array(unitSupportLanguageDTOSchema),
  unitTranslationLanguages: t.Array(languageSchema),
  contentTranslationLanguages: t.Array(languageSchema),
});

export type UnitLanguageAvailability =
  (typeof unitLanguageAvailabilitySchema)["static"];

export const unitLanguageAvailabilityResponseSchema =
  unitLanguageAvailabilitySchema;

export type UnitLanguageAvailabilityResponse =
  (typeof unitLanguageAvailabilityResponseSchema)["static"];

export const unitLanguageContentQuerySchema = t.Object({
  explicitLanguage: t.Optional(languageSchema),
  appLocale: t.Optional(languageSchema),
});

export type UnitLanguageContentQuery =
  (typeof unitLanguageContentQuerySchema)["static"];

export const unitLanguageContentResponseSchema = t.Object({
  unitId: t.String(),
  requestedLanguage: t.Optional(languageSchema),
  resolvedLanguage: t.Optional(t.Nullable(languageSchema)),
  supportLanguages: t.Array(unitSupportLanguageDTOSchema),
  unitTranslation: t.Optional(t.Nullable(unitTranslationDTOSchema)),
  contentTranslation: t.Optional(t.Nullable(contentTranslationDTOSchema)),
  title: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
  content: t.Optional(t.Nullable(t.Any())),
});

export type UnitLanguageContentResponse =
  (typeof unitLanguageContentResponseSchema)["static"];
