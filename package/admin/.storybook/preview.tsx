import { setLocale } from "@rezics/i18n/react";
import {
  basePreviewParameters,
  localeGlobalTypes,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import type { Decorator, Preview } from "@storybook/react-vite";

import "virtual:uno.css";

import { initI18n } from "../src/app/providers/i18n";

const DEFAULT_LANGUAGE = "zh-hant";

const withLocale: Decorator = (Story, context) => {
  const locale = context.globals.locale ?? DEFAULT_LANGUAGE;
  initI18n();
  setLocale(locale);
  document.documentElement.lang = locale;
  return <Story />;
};

const preview: Preview = {
  globalTypes: { ...themeGlobalTypes, ...localeGlobalTypes },
  decorators: [withLocale, withRezicsTheme({ canvas: "none" })],
  parameters: basePreviewParameters,
};

export default preview;
