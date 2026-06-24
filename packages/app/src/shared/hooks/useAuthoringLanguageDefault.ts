import { userQueries } from "@rezics/contract/api/user/user.queries";
import {
  type ContentLanguage,
  DEFAULT_LANGUAGE,
  normalizeContentLanguage,
} from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveAuthoringLanguageDefault } from "../utils/authoring-language";
import { detectContentLanguage } from "../utils/content-language-detection";

export function useAuthoringLanguageDefault(options?: {
  explicitLanguage?: string | null;
  fallbackLanguage?: string | null;
}): ContentLanguage {
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
  const [language, setLanguageState] =
    useState<ContentLanguage>(defaultLanguage);

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

export function useAutoDetectedAuthoringLanguageState(options: {
  text: string;
  initialLanguage?: string | null;
  fallbackLanguage?: string | null;
  enabled?: boolean;
  debounceMs?: number;
}) {
  const defaultLanguage = useAuthoringLanguageDefault({
    explicitLanguage: options.initialLanguage,
    fallbackLanguage: options.fallbackLanguage,
  });
  const userSelectedRef = useRef(Boolean(options.initialLanguage));
  const [language, setLanguageState] =
    useState<ContentLanguage>(defaultLanguage);

  useEffect(() => {
    if (userSelectedRef.current) return;
    setLanguageState(defaultLanguage);
  }, [defaultLanguage]);

  useEffect(() => {
    if (userSelectedRef.current || options.enabled === false) return;
    const timer = window.setTimeout(() => {
      const detected = detectContentLanguage(options.text, {
        fallbackLanguage: defaultLanguage,
      });
      if (detected) setLanguageState(detected.language);
    }, options.debounceMs ?? 750);

    return () => window.clearTimeout(timer);
  }, [defaultLanguage, options.debounceMs, options.enabled, options.text]);

  const setLanguage = (nextLanguage: string) => {
    userSelectedRef.current = true;
    setLanguageState(
      normalizeContentLanguage(nextLanguage) ??
        resolveAuthoringLanguageDefault({
          explicitLanguage: nextLanguage,
          fallbackLanguage: defaultLanguage,
        }),
    );
  };

  return {
    defaultLanguage,
    language,
    setLanguage,
    isLanguageManual: userSelectedRef.current,
  };
}
