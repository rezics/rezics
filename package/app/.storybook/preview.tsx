import {
  basePreviewParameters,
  themeGlobalTypes,
  withRezicsTheme,
} from "@rezics/storybook-config/preview";
import { getTheme } from "@rezics/ui";
import type { Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";

import { qc } from "../src/app/providers/reactQueryUtil";

import "virtual:uno.css";
import "@rezics/ui/shared/styles/layers.css";

const withQueryClient = (Story: React.ComponentType) => (
  <QueryClientProvider client={qc}>
    <Story />
  </QueryClientProvider>
);

const preview: Preview = {
  globalTypes: themeGlobalTypes,
  decorators: [
    withQueryClient,
    withRezicsTheme(getTheme, { canvas: { padding: 48 } }),
  ],
  parameters: { ...basePreviewParameters, layout: "fullscreen" },
};

export default preview;
