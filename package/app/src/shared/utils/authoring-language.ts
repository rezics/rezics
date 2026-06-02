import {
  DEFAULT_LANGUAGE,
  type Language,
  normalizeLanguage,
  resolveAuthoringLanguage,
} from "@rezics/contract";

export type AuthoringLanguageDefaultInput = {
  explicitLanguage?: string | null;
  preferredLanguages?: readonly (string | null | undefined)[] | null;
  appLocale?: string | null;
  fallbackLanguage?: string | null;
};

/**
 * Resolve the initial language for a new localized write.
 *
 * This is create-time defaulting only. Edit/update flows should keep using the
 * explicit language selected for the existing translation being modified.
 */
export function resolveAuthoringLanguageDefault(
  input: AuthoringLanguageDefaultInput,
): Language {
  return resolveAuthoringLanguage({
    explicitLanguage: normalizeLanguageInput(input.explicitLanguage),
    preferredLanguages: input.preferredLanguages
      ?.map(normalizeLanguageInput)
      .filter((language): language is Language => Boolean(language)),
    appLocale: normalizeLanguageInput(input.appLocale),
    fallbackLanguage:
      normalizeLanguageInput(input.fallbackLanguage) ?? DEFAULT_LANGUAGE,
  });
}

function normalizeLanguageInput(language: string | null | undefined) {
  return language ? normalizeLanguage(language) : null;
}
