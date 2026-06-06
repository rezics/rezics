import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Rezics",
  description: "Documentation for Rezics",
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
          { text: "Database Workflow", link: "/guide/database-workflow" },
          { text: "Git Workflow", link: "/guide/git-workflow" },
          { text: "Monorepo", link: "/guide/monorepo" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Tools", link: "/reference/tools" },
          { text: "TanStack Router", link: "/reference/tanstack-router" },
          {
            text: "Production Runtime Inventory",
            link: "/reference/production-runtime-inventory",
          },
          {
            text: "Production Env and Secrets",
            link: "/reference/production-env-and-secrets",
          },
        ],
      },
      {
        text: "Operations",
        items: [
          {
            text: "Production Bootstrap",
            link: "/operations/production-bootstrap",
          },
          {
            text: "Production Release",
            link: "/operations/production-release",
          },
          {
            text: "Production Rollback",
            link: "/operations/production-rollback",
          },
          {
            text: "Production Troubleshooting",
            link: "/operations/production-troubleshooting",
          },
          {
            text: "age Key Management",
            link: "/operations/age-key-management",
          },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/Edge-coordinates/rezics" },
    ],
  },
});
