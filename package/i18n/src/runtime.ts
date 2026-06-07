/**
 * Shared i18next runtime instance used by the app, admin, UI library,
 * editor, folio, and Storybook. Bootstrap namespaces (`common`, `shell`,
 * `auth`) load in parallel during `createI18nRuntime()`; all other
 * namespaces lazy-load on first `useTranslation` resolution.
 *
 * The runtime persists the selected locale to
 * `localStorage['rezics-locale']` and detects the initial locale from
 * localStorage → cookie → navigator in that order.
 */

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  type Language,
} from "@rezics/contract/language-core";
import i18next, { type i18n } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

import {
  BOOTSTRAP_NAMESPACES,
  DEFAULT_NAMESPACE,
  NAMESPACES,
} from "./namespaces.ts";

const SUPPORTED_LANGUAGES = Object.values(LANGUAGES) as Language[];

export const LOCALE_STORAGE_KEY = "rezics-locale";
export const LOCALE_FETCH_PATH = "/locales/{{lng}}/{{ns}}.json";

export type RezicsI18nRuntimeOptions = {
  /**
   * Initial locale override (skips detector). Useful for SSR or tests.
   */
  initialLocale?: Language;
  /**
   * Override the path used to fetch namespace JSON. Defaults to
   * `/locales/{{lng}}/{{ns}}.json` and is suitable for any Vite app that
   * exposes the shared `package/i18n/locales/` tree at `/locales/`.
   */
  loadPath?: string;
  /**
   * Additional plugins (e.g. resource preloads for Storybook).
   */
  extraPlugins?: Parameters<i18n["use"]>[0][];
};

export type RezicsI18nRuntime = {
  i18n: i18n;
  /**
   * Fires the bootstrap fetch and resolves once all bootstrap namespaces
   * are present for the active locale.
   */
  ready: Promise<i18n>;
};

let sharedRuntime: RezicsI18nRuntime | null = null;

export function createI18nRuntime(
  options: RezicsI18nRuntimeOptions = {},
): RezicsI18nRuntime {
  if (sharedRuntime) return sharedRuntime;

  const instance = i18next.createInstance();
  instance.use(HttpBackend);
  if (!options.initialLocale) {
    instance.use(LanguageDetector);
  }
  instance.use(initReactI18next);
  for (const plugin of options.extraPlugins ?? []) {
    instance.use(plugin);
  }

  const initPromise = instance.init({
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: DEFAULT_NAMESPACE,
    ns: [...BOOTSTRAP_NAMESPACES],
    load: "currentOnly",
    lowerCaseLng: true,
    nonExplicitSupportedLngs: false,
    lng: options.initialLocale,
    interpolation: {
      // Preserve the existing Paraglide-style `{name}` placeholders so the
      // translation JSON does not need a global rewrite.
      prefix: "{",
      suffix: "}",
      escapeValue: false,
    },
    backend: {
      loadPath: options.loadPath ?? LOCALE_FETCH_PATH,
      requestOptions: { cache: "default" },
    },
    detection: {
      order: ["localStorage", "cookie", "navigator"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: [],
    },
    react: {
      useSuspense: true,
    },
  } as Parameters<i18n["init"]>[0]);

  const ready = initPromise.then(() => instance);

  // Surface the canonical namespace list so consumers can request lazy loads
  // ahead of time (e.g. on route prefetch).
  ready.then(() => {
    instance.options.ns = [...NAMESPACES];
  });

  // Mirror the active language into localStorage on change so cold reloads
  // pick the right namespace from the start.
  instance.on("languageChanged", (lng) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, lng);
    } catch {
      // ignore storage failures (incognito, quota)
    }
  });

  const runtime: RezicsI18nRuntime = { i18n: instance, ready };
  sharedRuntime = runtime;
  return runtime;
}

export function getI18nRuntime(): RezicsI18nRuntime {
  if (!sharedRuntime) {
    throw new Error(
      "[@rezics/i18n] runtime not initialized; call createI18nRuntime() first.",
    );
  }
  return sharedRuntime;
}

export function resetI18nRuntimeForTests(): void {
  sharedRuntime = null;
}

export type { Language };

/**
 * Return the text direction (`"ltr" | "rtl"`) for a given locale. Falls back
 * to `"ltr"` for unknown codes. Used by the app shell to set
 * `<html dir="...">` when the active locale changes.
 */
export function getTextDirection(locale?: string): "ltr" | "rtl" {
  const lng = locale ?? "en";
  try {
    const intl = new Intl.Locale(lng);
    // `textInfo.direction` is available in modern engines via the
    // `direction` extension of `Intl.Locale`. Fall back to `"ltr"` if the
    // runtime does not expose it.
    const dir = (
      intl as Intl.Locale & {
        textInfo?: { direction: "ltr" | "rtl" };
      }
    ).textInfo?.direction;
    return dir ?? "ltr";
  } catch {
    return "ltr";
  }
}
