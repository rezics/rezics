import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { getTheme } from "@rezics/ui/config/theme";
import type { Preview } from "@storybook/react-vite";

import "@rezics/ui/shared/styles/layers.css";

const preview: Preview = {
  globalTypes: themeGlobalTypes,
  decorators: [withRezicsTheme(getTheme, { canvas: { padding: 24 } })],
  parameters: {
    ...basePreviewParameters,
    layout: "centered",
  },
};

export default preview;
