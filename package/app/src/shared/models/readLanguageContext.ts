import { userQueries } from "@rezics/api/user/user.queries";
import { type Language, normalizeLanguage } from "@rezics/contract";
import { getLocale, LOCALE_STORAGE_KEY } from "@rezics/i18n/react";
import type { QueryClient } from "@tanstack/react-query";
import { selectHasMemberSession, useAuthSessionStore } from "../../user/states";

export type ResolvedReadLanguageContext = {
  languages: Language[];
  appLocale: Language;
};

export function uniqueReadLanguages(
  languages: readonly (string | null | undefined)[],
): Language[] {
  return [
    ...new Set(
      languages
        .map((language) => language?.trim())
        .map((language) => (language ? normalizeLanguage(language) : null))
        .filter((language): language is Language => Boolean(language)),
    ),
  ];
}

export function storedLocale(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function currentLocale(): string | null {
  try {
    return getLocale();
  } catch {
    return null;
  }
}

export function appLocaleFromReadState(input: {
  activeLocale: string | null | undefined;
  hasMemberSession: boolean;
  preferredLanguages: readonly (string | null | undefined)[];
  storedLocale: string | null;
}): Language {
  const activeLocale = input.activeLocale
    ? (normalizeLanguage(input.activeLocale) ?? "zh-hant")
    : "zh-hant";
  if (!input.hasMemberSession || input.storedLocale) return activeLocale;
  const firstPreferred = input.preferredLanguages[0];
  return firstPreferred
    ? (normalizeLanguage(firstPreferred) ?? activeLocale)
    : activeLocale;
}

export function resolveReadLanguageContext(input: {
  activeLocale: string | null | undefined;
  hasMemberSession: boolean;
  preferredLanguages: readonly (string | null | undefined)[];
  storedLocale: string | null;
}): ResolvedReadLanguageContext {
  const languages = input.hasMemberSession
    ? uniqueReadLanguages(input.preferredLanguages)
    : [];
  return {
    languages,
    appLocale: appLocaleFromReadState(input),
  };
}

export async function resolveRouteReadLanguageContext(
  queryClient: QueryClient,
): Promise<ResolvedReadLanguageContext> {
  const authState = useAuthSessionStore.getState();
  const hasMemberSession = selectHasMemberSession(authState);
  const settings = hasMemberSession
    ? await queryClient
        .ensureQueryData(userQueries.settings())
        .catch(() => null)
    : null;
  return resolveReadLanguageContext({
    activeLocale: currentLocale(),
    hasMemberSession,
    preferredLanguages: settings?.preferredLanguages ?? [],
    storedLocale: storedLocale(),
  });
}
