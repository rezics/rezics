import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import type { Preview } from "@storybook/react-vite";

import "virtual:uno.css";
import "@rezics/ui/config/tokens.css";

const preview: Preview = {
  globalTypes: themeGlobalTypes,
  decorators: [withRezicsTheme({ canvas: "none" })],
  parameters: basePreviewParameters,
};

export default preview;
