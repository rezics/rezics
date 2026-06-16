# Rezics 用户使用场景总览（UX）

本目录用中文系统性地描述 Rezics 中**所有可想象到的用户使用场景**，并为每一步给出涉及的**代码链接**（`相对路径:行号`，在支持的终端/编辑器中可点击跳转）。

> 文档定位：这是「场景 → 代码」的导航地图，便于理解某个用户动作在前后端各层经过了哪些文件，而非逐字 API 文档。权威行为始终以代码为准（类型/Schema、测试、`check:convention` 规则）。

## 怎么读这套文档

1. 先读本页的「架构与数据流」「应用骨架」，建立全局心智模型。
2. 按需进入对应章节（见下方「章节索引」）。
3. 每个场景统一格式：**入口/触发 → 前置条件 → 步骤（每步带代码链接）→ 关键数据流 → 边界/权限/异常**。

## 架构与数据流

Rezics 是 Bun 运行的全栈 TypeScript monorepo，workspace 在 `package/*`。一次用户动作的典型链路：

```
用户动作
  │
  ▼
路由层（TanStack 文件式路由）  package/app/src/routes/**
  │   Route = createFileRoute(...)，多数用 lazyRouteComponent 指向 feature 页面
  ▼
前端 feature（页面/区块/组件/模型/hooks） package/app/src/<feature>/{pages,sections,components,models,hooks}/**
  │   见 package/app/docs/feature standard.md：models/ 不得 import React/hooks/state
  ▼
数据访问层 @rezics/api（TanStack Query） package/api/src/<domain>/{<domain>.queries.ts,.mutations.ts,.api.ts,.keys.ts}
  │   契约优先，前端不复制 DTO
  ▼
后端域 Elysia API           package/server/src/<domain>/{<domain>.api.ts,.service.ts,.mapper.ts,.types.ts}
  │   域 API 在 package/server/src/index.ts 挂载
  ▼
契约类型 @rezics/contract    package/contract/src/<domain>/**
  │
  ▼
数据库（Drizzle）/ 搜索（Meilisearch）/ 通知与认证边界服务
```

关键约束（摘自 `AGENTS.md`）：

- 后端域文件命名：`{domain}.api.ts` / `.service.ts` / `.mapper.ts` / `.types.ts`，统一在 `package/server/src/index.ts:1` 挂载。
- API 类型契约优先放在 `@rezics/contract`，前端访问统一走 `@rezics/api`，不在 app 内重复 DTO。
- `@rezics/server` 与 `@rezics/auth` 使用**各自独立**的 Drizzle schema 与数据库。
- 运行时 env 校验：`@t3-oss/env-core` + Valibot（见 `package/app/src/env.ts`）。

## 应用骨架（所有场景共享）

### 路由布局

- 根路由：`package/app/src/routes/__root.tsx:9` — `createRootRouteWithContext`，挂 `<Outlet/>` 与 DevTools，404 走 `NotFoundContainer`（`__root.tsx:16`）。
- 主布局：`package/app/src/routes/_mainLayout.tsx:12` — 包裹 `MainLayout`（`package/app/src/core/layouts/MainLayout.tsx`），含侧边栏/页头/页脚，几乎所有面向用户的路由都挂在 `_mainLayout` 下。
- 编辑布局：`package/app/src/routes/_editor.tsx:3` — 仅渲染 `<Outlet/>`，编辑控制台具体外壳为 `package/app/src/core/layouts/EditConsoleLayout.tsx`。

### 导航（侧边栏）

- 唯一来源：`package/app/src/core/components/navigation/MainNavigation.tsx:241`（`NAVIGATION(context, options)`）。
- 主分组（始终可见）：Home / Books / Games / Media — `MainNavigation.tsx:73`。
- 未登录显示 Account 分组（登录/注册）— `MainNavigation.tsx:101`；管理员额外显示 Developer 分组 — `MainNavigation.tsx:190`。
- 登录后显示「Realms」分组（已加入社区列表）— `MainNavigation.tsx:124`（`buildRealmSection`）。
- 可见性枚举与类型：`package/app/src/core/components/navigation/navigation.ts:19`。
- 注意：`search/review/unit/shelf/create` 等路由**刻意不放进侧边栏**，只通过页面内入口或直链访问 — `MainNavigation.tsx:229`（`REMOVED_MAIN_SIDEBAR_SEGMENTS`）。

### 路由边界（loading / error / not-found / denied / unauthenticated）

- 统一来源：`package/app/src/core/routing/routeBoundaries.tsx`。
- `routeBoundaries()`（`routeBoundaries.tsx:183`）把 `pendingComponent`/`errorComponent`/`notFoundComponent` 展开进路由。
- 组件：`RouteLoading`（`:81`）、`RouteError`（`:99`）、`RouteDenied`（`:133`，无权限）、`RouteUnauthenticated`（`:148`，未登录引导去 `/login`）、`RouteNotFound`（`:171`）。

### 会话与全局初始化

- 应用挂载：`package/app/src/app/providers/useAppInit.ts:9` — 初始化 i18n（`initI18nStorage`）与基础设施 bootstrap（`useInfraBootstrap`），同步认证会话状态。
- 持久化设置加载：`package/app/src/app/providers/PersistentSettingsLoader.tsx`。
- i18n 运行时：`package/app/src/app/providers/i18n.ts:14`（`initI18n`）。
- React Query：`package/app/src/app/providers/react-query.tsx`、`reactQueryUtil.ts`。

## 章节索引

| # | 章节 | 主题 |
|---|------|------|
| 01 | [认证与账户](./01-认证与账户.md) | 注册/邮箱验证/登录登出/重置密码/个人主页/关注/设置/主题/语言 |
| 02 | [浏览与发现](./02-浏览与发现.md) | 首页信息流/书·游戏·媒体库/全局与分类搜索/标签页/实体页 |
| 03 | [作品详情与阅读](./03-作品详情与阅读.md) | 书籍详情标签页/目录与章节/节点阅读器/多语言版本/摘录/署名来源 |
| 04 | [创作与编辑](./04-创作与编辑.md) | 新建作品/编辑控制台/章节·标签·署名/修订历史与对比/实体·摘录/草稿 |
| 05 | [社区 Realm](./05-社区Realm.md) | 社区发现·创建/加入退出/信息流·置顶/发帖/管理·成员·治理/标签·Wiki·规则 |
| 06 | [帖子与评论](./06-帖子与评论.md) | 发帖/续写接龙/帖子详情/评论与嵌套回复/排序分页/Unit 统一模型 |
| 07 | [评价·反应·投票](./07-评价反应投票.md) | 书评 Review/短评 Remark/点赞反对 Reaction/投票 Poll/评分排序 Score |
| 08 | [书架·收藏·进度](./08-书架收藏进度.md) | 书架增删改/收藏弹窗·最爱/阅读进度/进度库/书架浏览布局 |
| 09 | [通知·私信·运营](./09-通知私信与运营.md) | 通知收件箱/私信 DM/拉黑/反馈与举报/运营审核后台/政策与 About |

## 完整路由地图（144 个路由文件）

下表把全部路由按区域归类，并标注所属章节；少数较深的子路由未单独展开，但已在对应章节涵盖其核心场景。

### 认证 / 账户 / 设置（→ 章节 01）

- `_mainLayout/login.tsx`、`register.tsx`、`complete-registration.tsx`、`reset-password.tsx`、`notice.tsx`、`theme-switch.tsx`
- 个人主页（slug 入口）：`_mainLayout/u/$userSlug.tsx` 及子页 `index/activity/content/collection/reactions/realms/shelves/followers/search/shelf/$slug`
- 个人主页（id 入口）：`_mainLayout/user/$userId.tsx` 及对应子页、`user/$userId/edit.tsx`
- 我的空间：`_mainLayout/u/me/dashboard.tsx`、`u/me/drafts.tsx`（→ 章节 04）、`u/me/progress.tsx`（→ 章节 08）
- `_mainLayout/user/me/*`：`index/route/edit/bookmark/follow/reaction`、`entity/index`、`entity/new`（→ 章节 04）
- 设置子树 `_mainLayout/user/me/setting/*`：`index/route/profile/account/security/preferences/notifications/library/connections/blocked/data/tokens`（账户/资料/安全/偏好见章节 01；`blocked` 拉黑见章节 09；`library` 书架布局见章节 08；`tokens` 为开发者令牌）

### 浏览与发现（→ 章节 02）

- `_mainLayout/index.tsx`（首页信息流）
- 库：`book/index.tsx`、`book/search.tsx`、`game/index.tsx`、`media/index.tsx`
- 搜索：`search/index.tsx`
- 通用 Unit：`unit/index.tsx`、`unit/$unitId/index.tsx`
- 标签：`t/$tagSlug.tsx`、`tag/$unitId.tsx`；按书/域的标签子树 `tag/book/$bookId/**`、`tag/domain/$unitId/**`
- 实体：`e/$entitySlug.tsx`、`entity/$unitId/index.tsx`
- Zone（专题区）：`z/$slug/index.tsx`、`z/$slug/search.tsx`

### 作品详情与阅读（→ 章节 03）

- `book/$bookId/route.tsx`、`index.tsx`、`info.tsx`、`content.tsx`、`discussion.tsx`、`review.tsx`、`variants.tsx`、`search.tsx`
- 节点阅读器：`book_/$bookId/node/$nodeId/index.tsx`
- 摘录：`excerpt/$unitId/index.ts`、`excerpt/book/$bookId.tsx`

### 创作与编辑（→ 章节 04）

- `create/index.tsx`、`book/new.tsx`
- 书籍编辑控制台 `_editor/book/$bookId/edit/*`：`route/index/chapter/$chapterId/tag/authority/history(+index/$sequence/compare/$targetSequence)`
- `_editor/entity/$unitId/edit.tsx`、`_editor/excerpt/$unitId/edit.tsx`

### 社区 Realm（→ 章节 05）

- `realm/index.tsx`、`new.tsx`、`search.tsx`
- `realm/$realmId/*`：`index/manage/create/search/post/$postUnitId`
- slug 短链 `r/$realmSlug.tsx`、`r/$realmSlug/manage.tsx`、`r/$realmSlug/post/$postUnitId.tsx`、`r/$realmSlug/shelf/$slug.tsx`

### 帖子与评论（→ 章节 06）

- `post/$rootPostUnitId/index.tsx`、`post/$rootPostUnitId/continue.$unitId.tsx`
- `_editor/post/$rootPostUnitId/edit.tsx`、`_editor/post/$rootPostUnitId/continue/$unitId/edit.tsx`、`_editor/realm/$realmId/post/$postUnitId/edit.tsx`

### 评价 / 反应 / 投票（→ 章节 07）

- 书评：`review/index.tsx`、`search.tsx`、`$reviewId/index.tsx`、`book/$bookId.tsx`、`new/$bookUnitId.tsx`、`_editor/review/$reviewId/edit.tsx`
- 短评：`remark/$reviewId/index.tsx`、`remark/book/$bookId.tsx`、`_editor/remark/$reviewId/edit.tsx`
- 投票：`poll/$unitId.tsx`、`poll/new.tsx`

### 书架 / 收藏 / 进度（→ 章节 08）

- `shelf/index.tsx`、`new.tsx`、`search.tsx`、`$shelfId/index.tsx`、`shelf/book/$bookId.tsx`、`_editor/shelf/$shelfId/edit.tsx`
- `u/me/progress.tsx`、`user/me/bookmark.tsx`、`u/$userSlug/shelves.tsx`、`u/$userSlug/collection.tsx`

### 通知 / 私信 / 运营 / 反馈（→ 章节 09）

- 收件箱：`inbox/notification.tsx`、`inbox/dm/index.tsx`、`inbox/dm/$conversationId.tsx`
- 运营后台：`staff/index.tsx`、`staff/audit.tsx`、`staff/case/$caseId.tsx`、`staff/account/$targetUserId.tsx`
- 反馈：`feedback/index.tsx`、`feedback/admin.tsx`
- 政策/About：`package/app/src/policy/**`、独立站点 `package/about/**`

## 链接准确性说明

- 各章节的代码链接由分簇的代码探索核实得到，绝大多数指向真实符号与行号。
- 个别条目在探索时标注了 `待查/待确认/TODO/MOCK`：这些表示该能力可能为占位/在建，或链接为最佳推断，**以源码当前状态为准**。
- 仓库处于活跃开发期，行号可能随提交漂移；若链接与实际不符，请以文件内的符号名定位。
