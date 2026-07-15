# @rezics/frontend

ViNext 驱动的 Next.js 兼容前端工作区。当前入口提供一个可运行的 REZICS 应用壳，并把路由、功能组合和共享 UI 使用方分开，便于后续按领域扩展。

## 目录约定

- `app/`：Next.js 兼容路由、根布局和全局主题；`(app)` 与 `(auth)` 分别组织应用页和认证页，不改变公开 URL。
- `features/`：按业务能力拆分的界面组合；新能力应在这里拥有自己的目录，而非堆进页面入口。
- `app/(app)/app-shell.tsx`、`app/providers.tsx`：将路由、认证、翻译和 API 注入共享 UI 的应用适配层。
- `@rezics/ui`：位于 `libraries/ui` 的 SharkUI 与自定义共享组件；从包根直接导入。
- `lib/`：跨功能的无状态工具。

## 常用命令

在仓库根目录运行：

```sh
task frontend:dev
task frontend:build
task frontend:typecheck
```

## 认证开发

前端通过 `/api/auth` 访问 Better Auth；开发服务器会将该路径代理到后端的 `http://localhost:3001`，使会话 Cookie 保持第一方。启动前端时同时启动后端，并在部署环境为 `/api/auth` 配置等效的反向代理。

## PWA

生产构建通过 `vite-plugin-pwa` 生成支持中英文的 Web App Manifest 与 Workbox service worker。开发服务器默认不注册 service worker，避免缓存干扰热更新；请用生产构建在 HTTPS 或 localhost 环境验证安装、更新与离线回退。PWA 不缓存 API、RSC 响应或页面数据，只预缓存带版本的客户端静态资源与离线页。

## 使用与新增 UI 组件

组件直接从共享包使用：

```tsx
import { Button, Card } from "@rezics/ui";
```

新增或更新 SharkUI 组件请在 `libraries/ui` 操作，并在写入前使用 `--dry-run` 与 `--diff` 审查变化。共享主题已由 `app/styles.css` 导入。
