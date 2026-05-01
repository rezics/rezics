import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../.storybook-stories/**/*.stories.@(ts|tsx|mdx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      builder: {
        viteConfigPath: ".storybook/vite.config.ts",
      },
    },
  },
  refs: {
    ui: {
      title: "UI · Foundation",
      url: "http://localhost:6007",
      expanded: true,
    },
    editor: {
      title: "Editor · CodeMirror",
      url: "http://localhost:6008",
      expanded: true,
    },
  },
  addons: [],
  core: {
    disableTelemetry: true,
  },
  typescript: {
    check: false,
    reactDocgen: false,
  },
};

export default config;
