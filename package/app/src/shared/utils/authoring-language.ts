import {
  type ContentLanguage,
  DEFAULT_LANGUAGE,
  normalizeContentLanguage,
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
): ContentLanguage {
  return resolveAuthoringLanguage({
    explicitLanguage: normalizeLanguageInput(input.explicitLanguage),
    preferredLanguages: input.preferredLanguages
      ?.map(normalizeLanguageInput)
      .filter((language): language is ContentLanguage => Boolean(language)),
    appLocale: input.appLocale ? normalizeLanguage(input.appLocale) : null,
    fallbackLanguage:
      normalizeLanguageInput(input.fallbackLanguage) ?? DEFAULT_LANGUAGE,
  });
}

function normalizeLanguageInput(language: string | null | undefined) {
  return language ? normalizeContentLanguage(language) : null;
}
