import {
  createLocaleGlobalTypes,
  withI18n,
} from "@rezics/storybook-config/i18n";
import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import type { Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";

import { qc } from "../src/app/providers/reactQueryUtil";
import de from "../src/locale/de.ts";
import en from "../src/locale/en.ts";
import ja from "../src/locale/ja.ts";
import zhHans from "../src/locale/zh-hans.ts";
import zhHant from "../src/locale/zh-hant.ts";

import "virtual:uno.css";
import "@rezics/ui/shared/styles/layers.css";

const DEFAULT_LANGUAGE = "zh-hant";

const localeGlobalTypes = createLocaleGlobalTypes({
  defaultLanguage: DEFAULT_LANGUAGE,
  locales: [
    { value: "zh-hant", title: "繁體中文" },
    { value: "zh-hans", title: "简体中文" },
    { value: "en", title: "English" },
    { value: "ja", title: "日本語" },
    { value: "de", title: "Deutsch" },
  ],
});

const withQueryClient = (Story: React.ComponentType) => (
  <QueryClientProvider client={qc}>
    <Story />
  </QueryClientProvider>
);

const preview: Preview = {
  globalTypes: { ...themeGlobalTypes, ...localeGlobalTypes },
  decorators: [
    withQueryClient,
    withI18n(
      {
        en: { translation: en },
        "zh-hant": { translation: zhHant },
        "zh-hans": { translation: zhHans },
        de: { translation: de },
        ja: { translation: ja },
      },
      { defaultLanguage: DEFAULT_LANGUAGE, fallbackLng: "en" },
    ),
    withRezicsTheme({ canvas: { padding: 48 } }),
  ],
  parameters: { ...basePreviewParameters, layout: "fullscreen" },
};

export default preview;
