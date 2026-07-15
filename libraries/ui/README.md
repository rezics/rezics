# @rezics/ui

共享 UI 工作区是 SharkUI 上游组件与 REZICS 自定义组件的唯一源码。所有组件均从包根导出：

```tsx
import { Button, PageHeading, QueryPending } from "@rezics/ui";
```

也可按组件拆分导入：

```tsx
import { Button } from "@rezics/ui/button";
import { PageHeading } from "@rezics/ui/custom/page-heading";
```

每个前端应用都应在自己的全局样式入口导入共享主题，并声明共享组件源码为 Tailwind 扫描源：

```css
@import "@rezics/ui/styles.css";

@source "../../libraries/ui/src";
```

自定义组件通过 `UiProvider` 接收本地化文案和实体搜索实现；认证、路由和 API 客户端留在各应用的适配层。这样 Admin 等应用可以重用组件，而不继承 REZICS 前台的运行时耦合。

新增或更新 SharkUI 组件时先在此包预览差异：

```sh
yarn dlx shadcn@latest add @shark/<component> --dry-run --cwd libraries/ui
yarn dlx shadcn@latest add @shark/<component> --diff --cwd libraries/ui
```

## SharkUI 审计

运行以下命令会验证本地组件镜像、包根导出和前端使用规则：

```sh
task libraries:ui:shark-audit
```

它要求 `src/ui` 与仓库内的 SharkUI 注册表组件一一对应，并拒绝在 `frontend` 与
`src/custom` 中重新手写原生交互控件、复合 ARIA 控件、原生 `option`、物理方向和
`space-x/space-y` 工具类，以及非语义化的 Tailwind 色板类。应使用相应的 SharkUI
组件与其组成部分（例如 `NativeSelectOption`）替代。
