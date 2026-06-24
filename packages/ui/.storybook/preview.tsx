import { setLocale } from "@rezics/i18n/react";
import { createI18nRuntime } from "@rezics/i18n/runtime";
import {
  basePreviewParameters,
  localeGlobalTypes,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { registerUiLocale } from "@rezics/ui/i18n";
import type { Decorator, Preview } from "@storybook/react-vite";

import "virtual:uno.css";

const runtime = createI18nRuntime();

const withUiLocale: Decorator = (Story, context) => {
  const locale = context.globals.locale ?? "zh-hant";
  void runtime.ready.then(async () => {
    await registerUiLocale(runtime.i18n, locale);
    await setLocale(locale);
  });
  document.documentElement.lang = locale;
  return <Story />;
};

const preview: Preview = {
  globalTypes: { ...themeGlobalTypes, ...localeGlobalTypes },
  decorators: [withUiLocale, withRezicsTheme({ canvas: { padding: 24 } })],
  parameters: basePreviewParameters,
};

export default preview;
