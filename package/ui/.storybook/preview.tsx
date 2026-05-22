import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { setLocale } from "@rezics/ui/i18n/runtime";
import type { Preview } from "@storybook/react-vite";

import "virtual:uno.css";

const localeGlobalTypes = {
  locale: {
    name: "Locale",
    description: "UI language",
    defaultValue: "zh-hant",
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

const withUiLocale = (Story: React.ComponentType, context: any) => {
  setLocale(context.globals.locale ?? "zh-hant", { reload: false });
  return <Story />;
};

const preview: Preview = {
  globalTypes: { ...themeGlobalTypes, ...localeGlobalTypes },
  decorators: [withUiLocale, withRezicsTheme({ canvas: { padding: 24 } })],
  parameters: basePreviewParameters,
};

export default preview;
