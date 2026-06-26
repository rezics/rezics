import { baseStorybookConfig } from "@rezics/storybook-config";

export default baseStorybookConfig({
  stories: ["./stories/**/*.stories.@(ts|tsx|mdx)"],
  refs: {
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
