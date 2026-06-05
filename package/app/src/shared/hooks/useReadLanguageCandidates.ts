import { userQueries } from "@rezics/api/user/user.queries";
import {
  type Language,
  type ListLanguageMode,
  normalizeLanguage,
} from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { selectHasMemberSession, useAuthSessionStore } from "@/user/states";

export type ReadLanguageContext = {
  languages: Language[];
  appLocale: Language;
  languageMode: ListLanguageMode;
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

export function useReadLanguageContext(): ReadLanguageContext {
  const locale = useLocale();
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    enabled: hasMemberSession,
    retry: false,
  });
  const preferredLanguages = settings?.preferredLanguages ?? [];

  return useMemo(() => {
    const languages = hasMemberSession
      ? uniqueLanguages([...preferredLanguages, locale])
      : uniqueLanguages([locale]);
    const normalizedLocale = normalizeLanguage(locale) ?? "zh-hant";
    return {
      languages,
      appLocale: normalizedLocale,
      languageMode: "preferred",
      ready: !hasMemberSession || preferredLanguages.length > 0,
    };
  }, [hasMemberSession, locale, preferredLanguages]);
}

export function useReadLanguageCandidates(): Language[] {
  return useReadLanguageContext().languages;
}
