import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Rezics Book Library",
  description: "Documentation for the Rezics Book Library platform",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/deployment" },
      { text: "Reference", link: "/reference/tools" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Deployment", link: "/guide/deployment" },
          { text: "Monorepo", link: "/guide/monorepo" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Tools", link: "/reference/tools" },
          { text: "TanStack Router", link: "/reference/tanstack-router" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/Edge-coordinates/rezics" },
    ],
  },
});
