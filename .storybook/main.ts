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
    folio: {
      title: "Folio · Reader",
      url: "http://localhost:6009",
      expanded: false,
    },
    admin: {
      title: "Admin",
      url: "http://localhost:6010",
      expanded: false,
    },
    app: {
      title: "App",
      url: "http://localhost:6011",
      expanded: false,
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
