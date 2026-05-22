import {
  basePreviewParameters,
  localeGlobalTypes,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { setLocale } from "@rezics/ui/i18n/runtime";
import type { Decorator, Preview } from "@storybook/react-vite";

import "virtual:uno.css";

const withUiLocale: Decorator = (Story, context) => {
  setLocale(context.globals.locale ?? "zh-hant", { reload: false });
  return <Story />;
};

const preview: Preview = {
  globalTypes: { ...themeGlobalTypes, ...localeGlobalTypes },
  decorators: [withUiLocale, withRezicsTheme({ canvas: { padding: 24 } })],
  parameters: basePreviewParameters,
};

export default preview;
