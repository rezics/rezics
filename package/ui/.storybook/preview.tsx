import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import type { Preview } from "@storybook/react-vite";

import { getTheme } from "../src/config/theme";

import "virtual:uno.css";
import "../src/shared/styles/layers.css";

const preview: Preview = {
  globalTypes: themeGlobalTypes,
  decorators: [withRezicsTheme(getTheme, { canvas: { padding: 24 } })],
  parameters: basePreviewParameters,
};

export default preview;
