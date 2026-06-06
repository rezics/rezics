import { baseStorybookConfig } from "@rezics/storybook-config";

export default baseStorybookConfig({
  stories: ["./stories/**/*.stories.@(ts|tsx|mdx)"],
  refs: {
    ui: {
      title: "UI · Foundation",
      url: "http://localhost:6007",
      expanded: true,
    },
    app: {
      title: "App · Main",
      url: "http://localhost:6011",
      expanded: false,
    },
    admin: {
      title: "Admin",
      url: "http://localhost:6010",
      expanded: false,
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
  },
});
