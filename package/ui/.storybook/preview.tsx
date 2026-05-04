import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import type { Preview } from "@storybook/react-vite";

import "virtual:uno.css";

const preview: Preview = {
  globalTypes: themeGlobalTypes,
  decorators: [withRezicsTheme({ canvas: { padding: 24 } })],
  parameters: basePreviewParameters,
};

export default preview;
