import { setLocale as setProductLocale } from "@rezics/i18n/runtime";
import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { setLocale as setUiLocale } from "@rezics/ui/i18n/runtime";
import type { Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";

import { qc } from "../src/app/providers/reactQueryUtil";

import "virtual:uno.css";

const DEFAULT_LANGUAGE = "zh-hant";

const localeGlobalTypes = {
  locale: {
    name: "Locale",
    description: "UI language",
    defaultValue: DEFAULT_LANGUAGE,
    toolbar: {
      icon: "globe",
      items: [
        { value: "zh-hant", title: "繁體中文" },
        { value: "zh-hans", title: "简体中文" },
        { value: "en", title: "English" },
        { value: "ja", title: "日本語" },
        { value: "de", title: "Deutsch" },
      ],
      dynamicTitle: true,
    },
  },
} as const;

const withQueryClient = (Story: React.ComponentType) => (
  <QueryClientProvider client={qc}>
    <Story />
  </QueryClientProvider>
);

const withLocale = (Story: React.ComponentType, context: any) => {
  const locale = context.globals.locale ?? DEFAULT_LANGUAGE;
  setProductLocale(locale, { reload: false });
  setUiLocale(locale, { reload: false });
  return <Story />;
};

const preview: Preview = {
  globalTypes: { ...themeGlobalTypes, ...localeGlobalTypes },
  decorators: [
    withQueryClient,
    withLocale,
    withRezicsTheme({ canvas: { padding: 48 } }),
  ],
  parameters: { ...basePreviewParameters, layout: "fullscreen" },
};

export default preview;
