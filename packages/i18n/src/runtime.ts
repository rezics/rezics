/**
 * Shared i18next runtime instance used by the app, admin, UI library,
 * editor, folio, and Storybook. Bootstrap namespaces (`common`, `shell`,
 * `auth`) load in parallel during `createI18nRuntime()`; all other
 * namespaces lazy-load on first `useTranslation` resolution.
 * 由 app、admin、UI 库、editor、folio 和 Storybook 共享的 i18next 运行时实例。
 * 引导命名空间（`common`、`shell`、`auth`）在 `createI18nRuntime()` 期间并行加载；
 * 其余所有命名空间在首次 `useTranslation` 解析时懒加载。
 *
 * The runtime persists the selected locale to
 * `localStorage['rezics-locale']` and detects the initial locale from
 * localStorage → cookie → navigator in that order.
 * 运行时将所选 locale 持久化到 `localStorage['rezics-locale']`，并按
 * localStorage → cookie → navigator 的顺序探测初始 locale。
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
   * 初始 locale 覆盖（跳过探测器）。适用于 SSR 或测试。
   */
  initialLocale?: Language;
  /**
   * Override the path used to fetch namespace JSON. Defaults to
   * `/locales/{{lng}}/{{ns}}.json` and is suitable for any Vite app that
   * exposes the shared `packages/i18n/locales/` tree at `/locales/`.
   * 覆盖用于获取命名空间 JSON 的路径。默认为 `/locales/{{lng}}/{{ns}}.json`，
   * 适用于任何在 `/locales/` 下暴露共享 `packages/i18n/locales/` 目录树的 Vite 应用。
   */
  loadPath?: string;
  /**
   * Additional plugins (e.g. resource preloads for Storybook).
   * 额外的插件（例如供 Storybook 使用的资源预加载）。
   */
  extraPlugins?: Parameters<i18n["use"]>[0][];
};

export type RezicsI18nRuntime = {
  i18n: i18n;
  /**
   * Fires the bootstrap fetch and resolves once all bootstrap namespaces
   * are present for the active locale.
   * 触发引导阶段的获取，并在当前 locale 的所有引导命名空间就绪后 resolve。
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
      // 保留现有的 Paraglide 风格 `{name}` 占位符，使翻译 JSON 无需全局改写。
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
  // 暴露规范的命名空间列表，使消费方可以提前请求懒加载（例如在路由预取时）。
  ready.then(() => {
    instance.options.ns = [...NAMESPACES];
  });

  // Mirror the active language into localStorage on change so cold reloads
  // pick the right namespace from the start.
  // 在语言变更时将当前语言镜像到 localStorage，使冷重载从一开始就选用正确的命名空间。
  instance.on("languageChanged", (lng) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, lng);
    } catch {
      // ignore storage failures (incognito, quota)
      // 忽略存储失败（无痕模式、配额限制）
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
 * 返回给定 locale 的文本方向（`"ltr" | "rtl"`）。对未知代码回退为 `"ltr"`。
 * 由 app shell 用于在当前 locale 变更时设置 `<html dir="...">`。
 */
export function getTextDirection(locale?: string): "ltr" | "rtl" {
  const lng = locale ?? "en";
  try {
    const intl = new Intl.Locale(lng);
    // `textInfo.direction` is available in modern engines via the
    // `direction` extension of `Intl.Locale`. Fall back to `"ltr"` if the
    // runtime does not expose it.
    // `textInfo.direction` 在现代引擎中可通过 `Intl.Locale` 的 `direction` 扩展获得。
    // 若运行时未暴露该字段，则回退为 `"ltr"`。
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
