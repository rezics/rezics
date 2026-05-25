import {
  basePreviewParameters,
  localeGlobalTypes,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { registerParaglideRuntime, setLocale } from "@rezics/i18n/react";
import * as uiRuntime from "@rezics/ui/i18n/runtime";
import type { Decorator, Preview } from "@storybook/react-vite";

import "virtual:uno.css";

let runtimeRegistered = false;

function ensureUiRuntimeRegistered() {
  if (runtimeRegistered) return;
  registerParaglideRuntime(uiRuntime);
  runtimeRegistered = true;
}

const withUiLocale: Decorator = (Story, context) => {
  const locale = context.globals.locale ?? "zh-hant";
  ensureUiRuntimeRegistered();
  setLocale(locale);
  document.documentElement.lang = locale;
  return <Story />;
};

const preview: Preview = {
  globalTypes: { ...themeGlobalTypes, ...localeGlobalTypes },
  decorators: [withUiLocale, withRezicsTheme({ canvas: { padding: 24 } })],
  parameters: basePreviewParameters,
};

export default preview;
