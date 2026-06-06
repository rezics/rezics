import type { i18n } from "i18next";

const importers: Record<string, () => Promise<unknown>> = {
  en: () => import("../../locales/en.ts"),
  de: () => import("../../locales/de.ts"),
  ja: () => import("../../locales/ja.ts"),
  ko: () => import("../../locales/ko.ts"),
  "zh-hans": () => import("../../locales/zh-hans.ts"),
  "zh-hant": () => import("../../locales/zh-hant.ts"),
};

const registered = new Set<string>();

/**
 * Dynamically import the requested locale's UI bundle and register it on the
 * shared i18next instance under the `ui` namespace. Idempotent per
 * (instance, locale) pair.
 */
export async function registerUiLocale(
  i18n: i18n,
  locale: string,
): Promise<void> {
  const importer = importers[locale];
  if (!importer) return;
  const key = `${(i18n as { id?: string }).id ?? "default"}:${locale}`;
  if (registered.has(key)) return;
  const mod = (await importer()) as { default: Record<string, string> };
  i18n.addResourceBundle(locale, "ui", mod.default, true, true);
  registered.add(key);
}
