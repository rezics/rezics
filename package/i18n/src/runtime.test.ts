import { afterEach, expect, test } from "bun:test";

import { createI18nRuntime, resetI18nRuntimeForTests } from "./runtime.ts";

const resources = {
  "zh-hant": {
    common: { ok: "繁中" },
    shell: {},
    auth: {},
    page: { home_hero_title_highlight: "與所愛的故事相遇" },
  },
  "zh-hans": {
    common: { ok: "简中" },
    shell: {},
    auth: {},
    page: { home_hero_title_highlight: "遇见你喜欢的故事" },
  },
  en: {
    common: { ok: "English" },
    shell: {},
    auth: {},
    page: { home_hero_title_highlight: "Meet the stories you love" },
  },
} as const;

const backend = {
  type: "backend" as const,
  init() {},
  read(
    language: string,
    namespace: string,
    callback: (error: Error | null, data: Record<string, string>) => void,
  ) {
    const languageResources =
      resources[language as keyof typeof resources] ?? {};
    const namespaceResources =
      languageResources[namespace as keyof typeof languageResources] ?? {};
    callback(null, namespaceResources);
  },
};

afterEach(() => {
  resetI18nRuntimeForTests();
});

test("resolves lowercase Chinese script locales from runtime resources", async () => {
  const runtime = createI18nRuntime({
    initialLocale: "zh-hant",
    extraPlugins: [backend],
  });
  const i18n = await runtime.ready;

  expect(i18n.t("common:ok")).toBe("繁中");

  await i18n.loadNamespaces(["page"]);
  expect(i18n.t("page:home_hero_title_highlight")).toBe("與所愛的故事相遇");

  await i18n.changeLanguage("zh-hans");
  expect(i18n.t("common:ok")).toBe("简中");
  expect(i18n.t("page:home_hero_title_highlight")).toBe("遇见你喜欢的故事");
});
