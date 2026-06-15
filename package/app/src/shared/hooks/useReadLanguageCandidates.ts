import { userQueries } from "@rezics/api/user/user.queries";
import type { Language } from "@rezics/contract";
import { LOCALE_STORAGE_KEY, setLocale, useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  resolveReadLanguageContext,
  storedLocale,
  uniqueReadLanguages,
} from "@/shared/models/readLanguageContext";
import { selectHasMemberSession, useAuthSessionStore } from "@/user/states";

export type ReadLanguageContext = {
  languages: Language[];
  appLocale: Language;
  ready: boolean;
};

export function appLocaleSeedFromPreferred(input: {
  hasMemberSession: boolean;
  preferredLanguages: readonly (string | null | undefined)[];
  storedLocale: string | null;
}): Language | null {
  if (!input.hasMemberSession || input.storedLocale) return null;
  const firstPreferred = input.preferredLanguages[0];
  return uniqueReadLanguages([firstPreferred])[0] ?? null;
}

export function useReadLanguageContext(): ReadLanguageContext {
  const locale = useLocale();
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const {
    data: settings,
    isFetched: settingsFetched,
    isError: settingsError,
  } = useQuery({
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
    const resolved = resolveReadLanguageContext({
      activeLocale: locale,
      hasMemberSession,
      preferredLanguages,
      storedLocale: storedLocale(),
    });
    return {
      languages: resolved.languages,
      appLocale: resolved.appLocale,
      ready: !hasMemberSession || settingsFetched || settingsError,
    };
  }, [
    hasMemberSession,
    locale,
    preferredLanguages,
    settingsError,
    settingsFetched,
  ]);
}

export function useReadLanguageCandidates(): Language[] {
  return useReadLanguageContext().languages;
}
