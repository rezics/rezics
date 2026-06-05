import { userQueries } from "@rezics/api/user/user.queries";
import type { ListLanguageMode } from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { selectHasMemberSession, useAuthSessionStore } from "@/user/states";

export type ReadLanguageContext = {
  languages: string[];
  appLocale: string;
  languageMode: ListLanguageMode;
  ready: boolean;
};

function uniqueLanguages(languages: readonly (string | null | undefined)[]) {
  return [
    ...new Set(
      languages
        .map((language) => language?.trim())
        .filter((language): language is string => !!language),
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
    return {
      languages,
      appLocale: locale,
      languageMode: "preferred",
      ready: !hasMemberSession || preferredLanguages.length > 0,
    };
  }, [hasMemberSession, locale, preferredLanguages]);
}

export function useReadLanguageCandidates(): string[] {
  return useReadLanguageContext().languages;
}
