import { setLocale } from "@rezics/i18n/react";
import {
  basePreviewParameters,
  localeGlobalTypes,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import type { Decorator, Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";

import { initI18n } from "../src/app/providers/i18n";
import { qc } from "../src/app/providers/reactQueryUtil";

import "virtual:uno.css";

const DEFAULT_LANGUAGE = "zh-hant";

const withQueryClient: Decorator = (Story) => (
  <QueryClientProvider client={qc}>
    <Story />
  </QueryClientProvider>
);

const withLocale: Decorator = (Story, context) => {
  const locale = context.globals.locale ?? DEFAULT_LANGUAGE;
  initI18n();
  setLocale(locale);
  document.documentElement.lang = locale;
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
