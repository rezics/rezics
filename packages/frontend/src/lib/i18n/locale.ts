"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useCallback, useEffect } from "react";

import { useTranslation } from "./i18n";

export const locales = ["en-US", "zh-CN"] as const;
export type Locale = (typeof locales)[number];
export type LocalePreference = Locale | "auto";

const STORAGE_KEY = "rezics.locale";

export const localeAtom = Atom.make<LocalePreference>("auto");

const isLocalePreference = (value: string): value is LocalePreference =>
  value === "auto" || locales.some((locale) => locale === value);

const TAGS: Record<Locale, Array<string>> = {
  "en-US": ["en-US"],
  "zh-CN": ["zh-CN"],
};

export const useT = () => {
  const preference = useAtomValue(localeAtom);
  return useTranslation(preference === "auto" ? undefined : TAGS[preference]);
};

export const useSetLocale = () => {
  const set = useAtomSet(localeAtom);
  return useCallback(
    (preference: LocalePreference) => {
      localStorage.setItem(STORAGE_KEY, preference);
      set(preference);
    },
    [set],
  );
};

export function LocaleSync() {
  const setLocale = useAtomSet(localeAtom);
  const [, tag] = useT();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && isLocalePreference(stored)) {
      setLocale(stored);
    }
  }, [setLocale]);

  useEffect(() => {
    document.documentElement.lang = tag;
  }, [tag]);

  return null;
}
