import { userQueries } from "@rezics/api/user/user.queries";
import { type Language, normalizeLanguage } from "@rezics/contract";
import { LOCALE_STORAGE_KEY, setLocale, useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { selectHasMemberSession, useAuthSessionStore } from "@/user/states";

export type ReadLanguageContext = {
  languages: Language[];
  appLocale: Language;
  ready: boolean;
};

function uniqueLanguages(languages: readonly (string | null | undefined)[]) {
  return [
    ...new Set(
      languages
        .map((language) => language?.trim())
        .map((language) => (language ? normalizeLanguage(language) : null))
        .filter((language): language is Language => !!language),
    ),
  ];
}

export function appLocaleSeedFromPreferred(input: {
  hasMemberSession: boolean;
  preferredLanguages: readonly (string | null | undefined)[];
  storedLocale: string | null;
}): Language | null {
  if (!input.hasMemberSession || input.storedLocale) return null;
  const firstPreferred = input.preferredLanguages[0];
  return firstPreferred ? (normalizeLanguage(firstPreferred) ?? null) : null;
}

export function useReadLanguageContext(): ReadLanguageContext {
  const locale = useLocale();
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    enabled: hasMemberSession,
    retry: false,
  });
  const preferredLanguages = settings?.preferredLanguages ?? [];

  useEffect(() => {
    if (!hasMemberSession) return;
    if (typeof localStorage === "undefined") return;
    let storedLocale: string | null = null;
    try {
      storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      return;
    }
    const nextLocale = appLocaleSeedFromPreferred({
      hasMemberSession,
      preferredLanguages,
      storedLocale,
    });
    if (nextLocale) void setLocale(nextLocale);
  }, [hasMemberSession, preferredLanguages]);

  return useMemo(() => {
    const languages = hasMemberSession
      ? uniqueLanguages(preferredLanguages)
      : [];
    const normalizedLocale = normalizeLanguage(locale) ?? "zh-hant";
    return {
      languages,
      appLocale: normalizedLocale,
      ready: !hasMemberSession || preferredLanguages.length > 0,
    };
  }, [hasMemberSession, locale, preferredLanguages]);
}

export function useReadLanguageCandidates(): Language[] {
  return useReadLanguageContext().languages;
}
