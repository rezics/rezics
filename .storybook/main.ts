import { baseStorybookConfig } from "@rezics/storybook-config";

export default baseStorybookConfig({
  stories: ["./stories/**/*.stories.@(ts|tsx|mdx)"],
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
  },
});
