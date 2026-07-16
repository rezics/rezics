# @rezics/about

`about.rezics.com` 的静态多语言产品站，使用 React 19、Vike、`vike-react`、MDX 与 Tailwind CSS 构建。

## 架构

- `src/content/`：六语言文案、产品注册表、页面事实和媒体清单。
- `pages/`：Vike 文件路由；全局配置开启 SSR、客户端路由、尾斜线与全量 prerender。
- `src/components/products/`：真实 React 页面与交互组件。
- `pages/_error/+Page.mdx`：MDX 错误页；仓库内 MDX 可直接导入 React 组件。
- `functions/_middleware.ts` 与 `public/_redirects`：Cloudflare 语言协商与旧 URL 永久重定向。

公开 URL 保持为：

```text
/[locale]/
/[locale]/products/
/[locale]/products/[slug]/
```

旧的单数 `product` 路径与 `entity-source` 会永久重定向。所有公开页面均由同一注册表生成 canonical、hreflang、Open Graph、JSON-LD 与 sitemap。

## Commands

从仓库根目录运行：

```bash
yarn task about:dev
yarn task about:check
yarn task about:test
yarn task about:build
yarn task about:test:dist
yarn task about:preview
```

Cloudflare Pages 的构建目录是 `apps/about/dist/client`。部署不依赖 `dist/server`。
