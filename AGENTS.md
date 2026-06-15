# AGENTS.md

Shared project instructions for coding agents. Keep this file short, concrete,
and repo-specific; move detailed rules to skills or docs.

## Project

Rezics (repo `rezics/rezics`) is a full-stack TypeScript monorepo for a
community-driven, cross-language catalog of works. Everything — books, games,
media, posts, shelves, tags, community `realm`s — is modeled as a unified
`Unit`, so the same catalog, classification, attribution, and social layers work
across content types and languages. Communities (`realm`s) collectively classify
and discuss works, co-locating a work's index, discussion, and collaborative
knowledge. Runtime and package manager: Bun. Workspaces live under `package/*`.

## Commands

The command surface is [go-task](https://taskfile.dev). Every workspace under
`package/*` owns a `Taskfile.yml`; the root `Taskfile.yml` aggregates them via
`includes`, so package tasks are namespaced (`task server:dev`, `task
app:build`). `bun` stays under the hood only — runtime (it executes the `tool/`
CLI), package manager (`bun install`), and bundler (`bun build`). Run `task` to
list everything.

```bash
task                     # list every task (task --list)
task dev                 # start full dev environment (Nomad: infra + app)
task dev:stop            # stop all services
task dev:status          # show service status
task dev:logs -- server  # follow logs for a specific task
task app:dev             # frontend app, Vite
task server:dev          # main Elysia API
task auth:dev            # auth service

task test                # all tests (bun test)
task format              # Biome format
task format:check        # Biome format check
task check:convention    # repo conventions
task check:tokens        # token checks
task knip                # unused exports/deps

task db:generate         # generate migrations (all schema units)
task db:migrate          # apply migrations (all schema units)
task seed:factory        # synthetic data — realistic preset
task seed:factory:fast   # synthetic data — fast preset

task storybook           # all Storybooks
task ui:storybook        # UI Storybook, port 6007
```

## Architecture Rules

- Backend domains use `{domain}.api.ts`, `.service.ts`, `.mapper.ts`, `.types.ts`.
  Mount domain APIs from `package/server/src/index.ts`.
- API types are contract-first in `@rezics/contract`; frontend access belongs in
  `@rezics/api`. Do not duplicate API DTOs in app code.
- `@rezics/server` and `@rezics/auth` use separate Drizzle schemas and databases.
- `package/app` features follow the layered structure in
  `package/app/docs/feature standard.md`. `models/` must not import React,
  hooks, or state modules; external consumers go through the feature `index.ts`.
- Runtime env validation uses `@t3-oss/env-core` + Valibot. Keep env dependencies
  isolated from module exports.

## Workflows

- For ambiguous, architectural, or high-blast-radius work, clarify the intended
  outcome and editing scope before changing files.
- In this development-stage project, internal renames are clear cutovers: update
  all internal callsites in the same change unless a plan explicitly says
  otherwise.
- Main branch is `main`. See `CONTRIBUTING.md` for the mainline/archive Git
  workflow.
- Database migrations are Drizzle-first. See
  `docs/guide/database-workflow.md`; do not hand-author ordinary schema
  migrations. Edit migration SQL only for custom SQL or documented
  Drizzle-generated SQL defects while keeping schema source in sync.
- Dirty working trees are normal. The maintainer may be editing in parallel, so
ignore unrelated unstaged/untracked changes and never revert, stash, clean, or
flag them.
- Stage only task-owned files by explicit path; never use `git add -A` or
`git add .`.
- Commit only when the index contains this task’s staged files. If unrelated staged files are staged, retry briefly; if still blocked, report them and stop.

## UI Work

- Load the `rezics-design` skill before editing or reviewing JSX, CSS, UnoCSS
  classes, tokens, typography, spacing, component selection, icons, or copy.
- Frontend user-facing product copy must go through `@rezics/i18n`; do not
  hard-code display strings in React components. Add or reuse locale keys under
  `package/i18n/locales/` and validate with `task check:i18n`.
- Authoritative UI rules live in `rezics-design`, the `@rezics/ui` Storybook, and
  the `check:convention` / `check:tokens` rules; do not duplicate those details
  here.
- For browser verification, prefer giving the user the exact URLs to verify
  after they run `task dev` from the repo root. Do not download browsers or
  run heavyweight browser automation unless the user explicitly asks.

## 前端交互铁律（`package/app/`）

- **永远不要求用户手动操作 ID**。任何需要用户指定实体（用户、realm、
  作品等）的交互，一律提供搜索/选择界面（搜索弹窗、combobox、自动补
  全），禁止要求用户粘贴或输入裸 ID。实体选择器以 `entity-picker`
  feature 为范本（Ark Combobox + 后端搜索端点 + 防抖）。
- **始终假设列表数量爆炸**。所有渲染列表的地方必须假设数据量可无限增
  长。分页、虚拟滚动、搜索过滤三者至少取其一；下拉选择器的选项超出合
  理上限时必须改用搜索型选择器（combobox）。侧边栏、收件箱、管理列表
  等无一例外。列表分页统一使用分页组件（每页固定条目 + 末页满载显示
  "加载更多"），对应后端列表端点必须提供 `limit`/`offset` 参数。
- **禁止为查单条状态拉取全量列表**。判断"当前用户是否已收藏/关注/
  加入"等单点状态时，必须使用按目标过滤的查询（如
  `?postId=…&limit=1`），禁止取回完整列表再在客户端 `find`/`some`。菜
  单内的状态查询置于懒挂载内容中，仅在打开时发起。
- **页面上下文已确立的信息不得在子元素中重复**。实体详情页（realm
  页、用户页、作品页等）的页头已声明了当前上下文，页内列表项不得再标注
  该上下文（realm 页的帖子卡片不显示所属 realm 名，用户主页的帖子不
  显示作者名）。共享列表组件必须提供按上下文隐藏冗余字段的 prop，聚合
  流（首页、搜索）才显示完整归属信息。
- **同一事实在一屏内只展示一次**。任何统计或属性（成员数、创建时间、
  帖子数等）在同一页面内只允许出现在一个位置；页头与侧栏简介之间分工
  明确，不得各自重复同一字段。
- **同一动作在一屏内只保留一个入口**。功能完全相同的按钮/链接不得在
  全局导航与页面局部同时出现；局部入口若存在（如预填当前 realm 的发帖
  按钮），全局入口须在该页面隐藏或降级，二者必须有行为差异才允许共存。
  每新增一个动作入口前，必须先检查当前页面已有入口并说明差异。

## 前端布局铁律（`package/app/`）

> 以下规则没有例外，违反任何一条即视为任务未完成。
> 具体的代码模式与示例见 `rezics-design` skill `patterns.md`。

- **先认上下文，后写样式**。写或改任何涉及宽度/居中/拉伸的 class
  前，必须先确认元素实际所处的格式化上下文（父级的 display 与
  align-items），并按该上下文的规则推导出最终几何。禁止凭块流直觉套用
  习惯写法，禁止"加上试试看"。
- **居中容器三件套**：`w-full max-w-* mx-auto` 三者必须同时出现，缺
  一不可。`mx-auto` 与 `max-w-*` 同用而缺 `w-full` 即为违规，见到即
  当场补齐。仅收缩居中（徽章、按钮等）可用 `w-fit mx-auto`，且此时不
  得出现 `max-w-*`。
- **宽度必须可静态推导**。每个容器的最终宽度必须能仅凭其 class 列表
  与父内容宽唯一确定（如 `w-full max-w-6xl mx-auto` ⇒ min(父内容宽,
  72rem) 且居中）。若结果还取决于内容刚好多宽、或父级恰好是什么
  display，该写法即违规。
- **包裹层不断约束链**。`DialogContent` ↔ `DialogBody`/`DialogFooter`
  这类成对组件靠直接 flex 父子关系传递高度约束。在两者之间插入任何产生
  DOM 节点的元素（`<form>`、`<div>`）都会断链——插入者必须显式接链：
  `<form className="flex min-h-0 flex-col">`。
- **同行并列元素必须处理窄、宽两端**。凡一行内并列多个元素，必须显式
  回答：**宽度不足时**——谁截断（`min-w-0` + `truncate`）、谁换行
  （`flex-wrap`）、谁隐藏（`hidden sm:inline`）、谁滚动
  （`overflow-x-auto`），固定项（图标、按钮、头像）必须 `shrink-0`；
  **宽度过大时**——谁伸展（`flex-1`）、谁封顶（`max-w-*`）、留白落在
  哪里。两个答案都必须体现在 TSDoc ASCII 预览中。
- **同行并列的控件必须等高，同列堆叠的等价元素必须等宽**。同一行内
  并列的可交互控件必须落在同一高度档位——同一 size 档或显式同 `h-*`；
  同一列纵向堆叠的等价元素必须等宽——`w-full` 或由列上下文 stretch。
  等高/等宽必须可静态推导。
- **浮层必须实测溢出行为**。凡内容高度可变的浮层（对话框、抽屉、
  popover），除四档宽度外还必须在矮视口（≤700px 高）实际渲染并目检：
  浮层整体在视口内、footer 贴在卡片内侧底部、body 在卡片内部滚动。必
  须制造超高内容让滚动真实发生后才许声称完成。
- **四档视口实测后才许声称完成**。任何影响布局的改动，必须在 320px
  （Mobile）、768px（Tablet）、1280px（Desktop）与 ≥2560px
  （Ultra-wide）四档视口下实际渲染并目检：整页骨架居中、留白对称、
  `main` 占满分配宽度、无水平溢出。只在单一常用宽度下看过不算验证；无
  法实测时必须如实声明未验证，不得宣称完成。

## 前端组件设计文档（`package/app/`）

- **每个有视觉设计的页面/组件必须在导出前用 TSDoc 注释描述预期设
  计**。注释体的 ASCII art 使用纯英文（保证等宽字体对齐），其余说明文
  字使用中文。
- **必须包含四档断点的设计草图**：Mobile（<640px）、
  Tablet（640px–1023px）、Desktop（1024px–1535px）、
  Ultra-wide（≥1536px），分别展示该断点下的布局、元素排列、导航形态与
  间距变化。
- **实现必须与 TSDoc 描述的设计完美一致**。
- 纯逻辑包裹组件（如 Providers、纯 context wrapper）不加无意义注释。
- **必须处理所有尺寸极端情况**。每个组件须考虑内容为空、单行、超长文
  本、极窄视口（320px）、极宽视口（≥2560px）等边界条件。
- **样式与 HTML 结构必须最简**。如果一个 class、wrapper 或属性的有无
  不影响渲染结果，则必须删除。

## References

- `CONTRIBUTING.md` - route, folder, seed, Storybook, and convention details.
- Authoritative behavior lives in code: types/schemas, tests, and the
  `check:convention` rules. `plan/` holds in-flight planning.
- `.agents/skills/` and `.claude/skills/` - task-specific agent guidance.
