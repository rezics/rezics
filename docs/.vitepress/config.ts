import { defineConfig } from "vitepress";

const rootGuideItems = [
  { text: "Deployment", link: "/guide/deployment" },
  { text: "Database Workflow", link: "/guide/database-workflow" },
  { text: "Git Workflow", link: "/guide/git-workflow" },
  { text: "Monorepo", link: "/guide/monorepo" },
  { text: "Observability", link: "/guide/observability" },
  {
    text: "Content Authority History",
    link: "/guide/content-authority-history",
  },
];

const rootSidebar = [
  {
    text: "Guide",
    items: rootGuideItems,
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
];

const zhHantGuideItems = [
  { text: "部署", link: "/zh-hant/guide/deployment" },
  { text: "資料庫工作流程", link: "/zh-hant/guide/database-workflow" },
  { text: "Git 工作流程", link: "/zh-hant/guide/git-workflow" },
  { text: "Monorepo 結構", link: "/zh-hant/guide/monorepo" },
  { text: "後端可觀測性", link: "/zh-hant/guide/observability" },
  {
    text: "內容權威、歷史與 Wiki 所有權",
    link: "/zh-hant/guide/content-authority-history",
  },
];

export default defineConfig({
  title: "Rezics",
  description: "Documentation for Rezics",
  themeConfig: {
    socialLinks: [
      { icon: "github", link: "https://github.com/Edge-coordinates/rezics" },
    ],
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/deployment" },
          { text: "Reference", link: "/reference/tools" },
        ],
        sidebar: rootSidebar,
      },
    },
    "zh-hant": {
      label: "繁體中文",
      lang: "zh-Hant",
      link: "/zh-hant/",
      title: "Rezics",
      description: "Rezics 文件",
      themeConfig: {
        nav: [{ text: "指南", link: "/zh-hant/guide/deployment" }],
        sidebar: [
          {
            text: "指南",
            items: zhHantGuideItems,
          },
        ],
        outline: {
          label: "本頁內容",
        },
        darkModeSwitchLabel: "外觀",
        lightModeSwitchTitle: "切換到淺色模式",
        darkModeSwitchTitle: "切換到深色模式",
        sidebarMenuLabel: "選單",
        returnToTopLabel: "回到頂部",
        langMenuLabel: "切換語言",
        docFooter: {
          prev: "上一頁",
          next: "下一頁",
        },
      },
    },
  },
});
