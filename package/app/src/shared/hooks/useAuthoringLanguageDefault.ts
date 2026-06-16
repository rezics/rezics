import { userQueries } from "@rezics/api/user/user.queries";
import { DEFAULT_LANGUAGE, type Language } from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveAuthoringLanguageDefault } from "../utils/authoring-language";

export function useAuthoringLanguageDefault(options?: {
  explicitLanguage?: string | null;
  fallbackLanguage?: string | null;
}): Language {
  const locale = useLocale();
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    retry: false,
  });

  return useMemo(
    () =>
      resolveAuthoringLanguageDefault({
        explicitLanguage: options?.explicitLanguage,
        preferredLanguages: settings?.preferredLanguages,
        appLocale: locale,
        fallbackLanguage: options?.fallbackLanguage ?? DEFAULT_LANGUAGE,
      }),
    [
      locale,
      options?.explicitLanguage,
      options?.fallbackLanguage,
      settings?.preferredLanguages,
    ],
  );
}

export function useAuthoringLanguageState(options?: {
  initialLanguage?: string | null;
  fallbackLanguage?: string | null;
}) {
  const defaultLanguage = useAuthoringLanguageDefault({
    explicitLanguage: options?.initialLanguage,
    fallbackLanguage: options?.fallbackLanguage,
  });
  const userSelectedRef = useRef(Boolean(options?.initialLanguage));
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    if (userSelectedRef.current) return;
    setLanguageState(defaultLanguage);
  }, [defaultLanguage]);

  const setLanguage = (nextLanguage: string) => {
    userSelectedRef.current = true;
    setLanguageState(
      resolveAuthoringLanguageDefault({
        explicitLanguage: nextLanguage,
        fallbackLanguage: defaultLanguage,
      }),
    );
  };

  return { defaultLanguage, language, setLanguage };
}
