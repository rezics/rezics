import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  globalTypes: themeGlobalTypes,
  decorators: [withRezicsTheme({ canvas: { padding: 24 } })],
  parameters: {
    ...basePreviewParameters,
    layout: "centered",
  },
};

export default preview;
