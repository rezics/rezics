import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { getTheme } from "@rezics/ui";
import type { Preview } from "@storybook/react-vite";

import "virtual:uno.css";
import "@rezics/ui/shared/styles/layers.css";

const preview: Preview = {
  globalTypes: themeGlobalTypes,
  decorators: [withRezicsTheme(getTheme, { canvas: { padding: 48 } })],
  parameters: { ...basePreviewParameters, layout: "fullscreen" },
};

export default preview;
