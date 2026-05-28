/**
 * React adapter for the shared `@rezics/i18n` runtime. Wraps
 * `react-i18next`'s `I18nextProvider`, exposes `useTranslation` and `Trans`,
 * and adds an active-locale subscription compatible with the legacy
 * `useLocale()` API used by the app shell.
 */

import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import {
  I18nextProvider,
  Trans,
  useTranslation,
  initReactI18next,
} from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  type Language,
  normalizeLanguage,
} from "@rezics/contract/language-core";

import {
  createI18nRuntime,
  getI18nRuntime,
  LOCALE_STORAGE_KEY,
  type RezicsI18nRuntime,
} from "./runtime.ts";

export type RezicsI18nProviderProps = {
  children: ReactNode;
  runtime?: RezicsI18nRuntime;
};

/**
 * Mounts the shared i18next instance for the React tree. Suspends the
 * subtree until bootstrap namespaces have loaded (driven by
 * `useSuspense: true` in `runtime.ts`).
 */
export function RezicsI18nProvider({
  children,
  runtime,
}: RezicsI18nProviderProps): ReactNode {
  const active = runtime ?? createI18nRuntime();
  return <I18nextProvider i18n={active.i18n}>{children}</I18nextProvider>;
}

/**
 * Subscribe to the active locale. Returns the normalized Rezics language
 * code, falling back to `DEFAULT_LANGUAGE` until i18next reports a value.
 */
export function useLocale(): Language {
  const runtime = getI18nRuntime();
  return useSyncExternalStore(
    (listener) => {
      runtime.i18n.on("languageChanged", listener);
      return () => {
        runtime.i18n.off("languageChanged", listener);
      };
    },
    () => normalizeLanguage(runtime.i18n.language) ?? DEFAULT_LANGUAGE,
    () => DEFAULT_LANGUAGE,
  );
}

/**
 * Imperatively switch the active locale. Persists to localStorage via the
 * runtime's `languageChanged` listener.
 */
export function setLocale(locale: Language | string): Promise<void> {
  const next = normalizeLanguage(locale);
  if (!next) {
    return Promise.reject(
      new RangeError(`Unsupported Rezics locale: ${locale}`),
    );
  }
  return getI18nRuntime().i18n.changeLanguage(next).then(() => {});
}

export function useSetLocale(): (locale: Language | string) => Promise<void> {
  return setLocale;
}

/**
 * Imperative subscription used by non-React code paths (e.g. Storybook
 * decorators). Returns an unsubscribe handle.
 */
export function subscribeLocale(listener: () => void): () => void {
  const runtime = getI18nRuntime();
  runtime.i18n.on("languageChanged", listener);
  return () => {
    runtime.i18n.off("languageChanged", listener);
  };
}

export function getLocale(): Language {
  return (
    normalizeLanguage(getI18nRuntime().i18n.language) ?? DEFAULT_LANGUAGE
  );
}

/**
 * Re-export the typed `useTranslation` and `Trans` from react-i18next.
 */
export { Trans, useTranslation, initReactI18next };

export { LOCALE_STORAGE_KEY };
export type { RezicsI18nRuntime };
