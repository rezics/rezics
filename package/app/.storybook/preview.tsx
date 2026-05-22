import { setLocale as setProductLocale } from "@rezics/i18n/runtime";
import {
  basePreviewParameters,
  localeGlobalTypes,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { setLocale as setUiLocale } from "@rezics/ui/i18n/runtime";
import type { Decorator, Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";

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
