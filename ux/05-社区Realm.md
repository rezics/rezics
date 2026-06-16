> 本章属于 [Rezics UX 总览](./README.md)。数据流与应用骨架见总览。
> `realm/$realmId/*` 为 id 入口，`r/$realmSlug/*` 为 slug 短链（loader 解析 slug→id 后重定向）。

# 社区 Realm

支持用户发现、创建、管理社区，并在社区内发帖、管理成员、内容治理。

## 场景 1：浏览已加入的社区列表

**入口/触发**：侧边栏「Realms」分组，或 `/realm`。

**前置条件**：已登录。

**步骤**：
1. `/realm` → `RealmListPage` — `package/app/src/routes/_mainLayout/realm/index.tsx:1`–`10`。
2. `myRealmsQuery` 获取已加入社区 — `package/app/src/realm/pages/RealmListPage.tsx:45`–`52`。
3. `realmApi.mine()` — `package/api/src/realm/realm.api.ts:56`–`58`。
4. 后端按会话用户返回社区列表 — `package/server/src/realm/realm.service.ts`。
5. 映射列表项 — `RealmListPage.tsx:54`–`57`。
6. 点击卡片跳社区主页 — `RealmListPage.tsx:258`–`263`。

**关键数据流**：`/realm` → `RealmListPage` → `myRealmsQuery` → `realmApi.mine()` → `RealmService` → 契约 `RealmListResponse`。

**边界/权限/异常**：未登录显示登录提示（`:74`–`88`）；Manage 模式批量退出（`:109`–`149`）；私有/官方标记（`:221`–`223`）。

## 场景 2：搜索社区

**入口/触发**：`/realm/search` 或搜索框。

**前置条件**：无需登录（仅搜公开社区）。

**步骤**：
1. `/realm/search` → `RealmSearchPage` — `package/app/src/routes/_mainLayout/realm/search.tsx:1`–`10`。
2. `useLocalizedRealmSearch()` — `package/app/src/realm/pages/RealmSearchPage.tsx:42`–`48`（Meili 检索）。
3. 结果映射 RealmDTO — `RealmSearchPage.tsx:14`–`37`。
4. 网格 `RealmCard` — `RealmSearchPage.tsx:74`–`77`。

**关键数据流**：`/realm/search` → `RealmSearchPage` → `useLocalizedRealmSearch()` → Meili → RealmDTO。

**边界/权限/异常**：空查询不查询（`query.length>0`）；私有社区不出现；无结果提示。

## 场景 3：创建新社区

**入口/触发**：「Create Realm」→ `/realm/new`。

**前置条件**：已登录；受创建策略约束。

**步骤**：
1. `/realm/new` → `NewRealmPage` — `package/app/src/routes/_mainLayout/realm/new.tsx:1`–`10`。
2. 表单：名称/描述/标签视图风格/查看器开关 — `package/app/src/realm/pages/NewRealmPage.tsx:21`–`86`。
3. 「Create」→ `useCreateRealmMutation()` — `NewRealmPage.tsx:25`、`:32`–`49`。
4. `POST /realm`（CreateRealmInput）— `package/api/src/realm/realm.mutations.ts:82`–`99`。
5. 权限检查 `governanceRoutePolicyService.decideForIdentity()` — `package/server/src/realm/realm.api.ts:104`–`116`。
6. 事务创建 Unit/UnitTranslation/Realm/RealmMember(owner) — `package/server/src/realm/realm.service.ts:448`–`522`。
7. 返回 Realm，导航 `unitHref({type:"REALM",unitId,slug})` — `NewRealmPage.tsx:51`–`58`。
8. 异步索引同步 — `realm.service.ts:515`。

**关键数据流**：`/realm/new` → `NewRealmPage` → `useCreateRealmMutation()` → `realmApi.create()` → `realmService.create()` → 契约 `CreateRealmInput`/`RealmResponse`。

**边界/权限/异常**：拒绝显示 `PolicyDenialNotice`（`:122`–`124`）；创建者成为 owner；索引异步更新。

## 场景 4：进入社区主页（ID 入口）

**入口/触发**：列表点击、`/realm/:realmId`、搜索卡片。

**前置条件**：社区存在；私有社区需成员。

**步骤**：
1. `/realm/$realmId/` validateSearch（sort/tab/tags）— `package/app/src/routes/_mainLayout/realm/$realmId/index.tsx:28`–`81`。
2. `realmDetailQuery(realmId)` — `package/app/src/realm/pages/RealmPage.tsx:107`–`113`。
3. `myRealmMembershipQuery(realmId)` — `RealmPage.tsx:114`。
4. 后端返回完整信息（banner/avatar/description/memberCount/extra）— `package/server/src/realm/realm.api.ts`。
5. 按成员状态显示：成员→Create/Mute/Leave（`:196`–`209`）；非成员→Join 提示（`:204`–`208`）。
6. 默认 feed 标签 + 置顶 + 信息流。
7. 其他标签：wiki/tags/about/members。

**关键数据流**：`/realm/$realmId/` → `RealmPage` → `realmDetailQuery()` + `myRealmMembershipQuery()` → `realmApi.get()` → 契约 `RealmResponse`。

**边界/权限/异常**：不存在显示「Realm not found」（`:146`–`149`）；私有非成员仅见基本信息；Wiki 标签始终可见并由空状态兜底；管理员见 Manage/置顶/精华（`:182`–`191`）。

## 场景 5：通过 Slug 进入社区（短链）

**入口/触发**：`/r/:realmSlug`。

**前置条件**：slug 存在。

**步骤**：
1. `/r/$realmSlug` loader — `package/app/src/routes/_mainLayout/r/$realmSlug.tsx:1`–`17`。
2. `slugApi.resolve({scope:"realm",slug})` — `r/$realmSlug.tsx:7`–`10`。
3. 未找到 notFound()，否则重定向 `/realm/$realmId` — `:12`–`15`。

**关键数据流**：`/r/$realmSlug/` → `slugApi.resolve()` → slug.api → 重定向 `/realm/$realmId`。

**边界/权限/异常**：slug 不存在 404；服务端重定向无缝。

## 场景 6：查看社区信息流与置顶

**入口/触发**：社区主页默认 Feed 标签。

**前置条件**：公开社区可看，私有需成员。

**步骤**：
1. Feed 标签内容 — `package/app/src/realm/pages/RealmPage.tsx:243`–`325`。
2. `RuleSection`（规则摘要）— `:246`–`249`。
3. `PinnedFeedSection`（置顶）— `:304` → `usePinboardList({realmUnitId,key:"pinboard"})`（`package/app/src/pinboard/sections/PinnedFeedSection.tsx:41`–`44`），水平滚动卡片（`:76`–`88`）。
4. `RealmContentFeed`（主流）— `:305`–`313` → `feedRowsInfiniteQuery()`（`package/app/src/realm/components/RealmContentFeed.tsx:52`–`64`）。
5. 支持 sort/tagIds/realmModerationStatus 过滤；无限滚动；点击进帖子详情。

**关键数据流**：`RealmPage` → `PinnedFeedSection` + `RealmContentFeed` → `feedRowsInfiniteQuery()` → feed.api → 契约 `PostListQuery`/`FeedContentRow`。

**边界/权限/异常**：无置顶不显示（`PinnedFeedSection.tsx:62`）；管理员 Manage 模式显示审核过滤（`RealmPage.tsx:264`–`301`）；`?tags=` 过滤。

## 场景 7：加入社区

**入口/触发**：社区主页「Join」。

**前置条件**：未加入；需登录。

**步骤**：
1. `JoinButton` 监听状态 — `package/app/src/realm/components/JoinButton.tsx:20`–`100`。
2. 检查是否有规则 — `:39`–`47`。
3. 有规则未读弹 `RealmRuleDialog` — `:73`–`76`、`:90`–`97`。
4. `useJoinRealmMutation()`（需先 ack 规则，后端 `realm.service.ts:601`–`617`）。
5. `POST /:unitId/members` — `package/server/src/realm/realm.api.ts:973`–`991`。
6. 创建 RealmMember（ACTIVE/PENDING）— `package/server/src/realm/realm.service.ts:619`–`630`。
7. 创建 Subscription(channels=['*']) — `:654`–`660`。
8. 更新 memberCount — `:634`–`641`。
9. 需审批则通知管理员 — `:247`–`276`。
10. onSuccess 刷新详情 — `JoinButton.tsx:61`–`68`。

**关键数据流**：`JoinButton` → `useJoinRealmMutation()` → `realmApi.join()` → `realmService.joinRealm()` → 契约 `JoinRealmInput`/`RealmMemberDTO`。

**边界/权限/异常**：私有社区需满足条件；规则须确认；需审批者初始 PENDING 不能发帖；自动订阅可后续 Mute。

## 场景 8：退出社区

**入口/触发**：主页「Leave」或列表 Manage 批量。

**前置条件**：为成员。

**步骤**：
1. 单个：`useLeaveRealmMutation()` — `package/app/src/realm/components/JoinButton.tsx:71`–`72`。
2. 批量：Manage 勾选 — `package/app/src/realm/pages/RealmListPage.tsx:141`–`149`，确认对话框（`:163`–`181`）。
3. `realmApi.leave(realmUnitId)` — `RealmListPage.tsx:66`–`69`。
4. `DELETE /:unitId/members/:userId` — `package/server/src/realm/realm.api.ts:1035`–`1076`，权限检查（`:1037`–`1055`）。
5. `realmService.removeMember()` — `:1056`–`1067`，删 RealmMember/减 memberCount/删 Subscription。
6. 缓存失效 — `package/api/src/realm/realm.mutations.ts:56`–`75`。

**关键数据流**：`JoinButton`/`RealmListPage` → `useLeaveRealmMutation()` → `realmApi.leave()` → `realmService.removeMember()` → 契约 `RealmMemberDTO`。

**边界/权限/异常**：不能退最后一个 owner；前端立即刷新；批量中单个失败不影响其他。

## 场景 9：在社区内发帖

**入口/触发**：主页「Create」→ `/realm/$realmId/create`。

**前置条件**：为成员；受发帖策略与角色约束。

**步骤**：
1. `/realm/$realmId/create` → `RealmCreatePage` — `package/app/src/routes/_mainLayout/realm/$realmId/create.tsx:1`–`31`。
2. 加载社区/成员信息 — `package/app/src/realm/pages/RealmCreatePage.tsx:53`–`62`（非成员显示 Join，`:90`）。
3. Tabs：post/wiki/poll/existing — `:10`–`44`、`:64`–`86`。
4. 默认 post 模式 `RealmPostCreateForm` — `:100+`。
5. `postApi.createRealmPost()` — `package/api/src/post/post.mutations.ts`。
6. `POST /post`（含 realmUnitId）— `package/server/src/post/post.api.ts`，权限 `governanceRoutePolicyService`。
7. 创建 Post/UnitPost — `package/server/src/post/post.service.ts`；需审批则 PENDING。
8. 导航 `/realm/$realmId/post/$postUnitId`。

**关键数据流**：`/realm/$realmId/create` → `RealmCreatePage` → `RealmPostCreateForm` → `createRealmPost()` → post.service → 契约 `PostResponse`。

**边界/权限/异常**：非成员禁用「Join to post」（`RealmPage.tsx:204`–`206`）；需审批社区帖子待审；wiki 在 Zone；poll 专用表单；existing 关联已有内容。

> 帖子/续写/评论的通用流程见 [章节 06](./06-帖子与评论.md)。

## 场景 10：查看社区内单篇帖子

**入口/触发**：Feed 点击 → `/realm/$realmId/post/$postUnitId`，或 `/r/$realmSlug/post/$postUnitId`。

**前置条件**：帖子存在且非删除/移除。

**步骤**：
1. id 入口 → `PostThreadPage` — `package/app/src/routes/_mainLayout/realm/$realmId/post/$postUnitId.tsx:1`–`11`。
2. `postDetailsQuery(postUnitId)` — `package/app/src/post/pages/PostThreadPage.tsx`。
3. 返回 PostResponse（含 unitRealm/comments）— `GET /post/:unitId`。
4. 渲染内容/作者/评论；可反应；管理员见审核操作。
5. slug 入口先解析 realm slug → realmId 再加载 — `package/app/src/routes/_mainLayout/r/$realmSlug/post/$postUnitId.tsx:6`–`21`。

**关键数据流**：`/realm/$realmId/post/$postUnitId` → `PostThreadPage` → `postDetailsQuery()` → `post.api.get()` → 契约 `PostResponse`。

**边界/权限/异常**：PENDING 仅作者/管理员可见；REMOVED 显示已删除；slug 不存在 404。

## 场景 11：管理社区（设置/成员/权限/治理）

**入口/触发**：主页齿轮 → `/realm/$realmId/manage`。

**前置条件**：owner/admin 或有管理权限。

**步骤**：
1. `/realm/$realmId/manage` validateSearch(tab) — `package/app/src/routes/_mainLayout/realm/$realmId/manage.tsx:1`–`45`。
2. `RealmManagePage` — `package/app/src/realm/pages/RealmManagePage.tsx:78`–`200`。
3. Tabs：Profile（名称/描述/avatar/banner）、Organization（标签树/Wiki Zone/精华公告）、Wiki、Moderation（审核队列）、Members（`:52`）、Danger（删除）。
4. 修改触发对应 mutation；`canManageRealm()` 判断（`package/app/src/realm/models/canManageRealm.tsx`）。

**关键数据流**：`/realm/$realmId/manage` → `RealmManagePage` → `useUpdateRealmMutation()`/`useDeleteRealmMutation()` → realm.api → 契约 `UpdateRealmInput`/`RealmResponse`。

**边界/权限/异常**：非管理员隐藏（`useServerPermission()`）；删除需二次确认；不能移除最后一个 owner；审核队列仅 PENDING。

## 场景 12：管理成员与角色

**入口/触发**：Manage → Members。

**前置条件**：owner/admin/moderator。

**步骤**：
1. `RealmMemberList` — `package/app/src/realm/components/RealmMemberList.tsx`。
2. `realmMembersQuery(realmUnitId,{cursor})` — `package/api/src/realm/realm.queries.ts:77`–`85`。
3. 编辑角色 → `useUpdateMemberRoleMutation()` — `package/api/src/realm/realm.mutations.ts`。
4. `PUT /:realmId/members/:userId` — `package/server/src/realm/realm.api.ts:993`–`1018`，`assertRealmMemberRolePolicy()`（`:1005`–`1012`）。
5. 防移除最后 owner `wouldRemoveLastRealmOwner()` — `package/contract/src/permission/realm-role.ts:39`–`49`。

**关键数据流**：Manage(Members) → `realmMembersQuery()`/`updateMemberRole()` → realm.api/service → 契约 `RealmMemberDTO`。

**边界/权限/异常**：moderator 不可改 owner/admin；层级 owner>admin>moderator>member；变更记审计。

## 场景 13：内容治理（审核/置顶）

**入口/触发**：Manage → Moderation，或主页 Manage 模式过滤。

**前置条件**：moderator/admin/owner。

**步骤**：
1. `RealmModerationQueueSection` — `package/app/src/realm/sections/RealmModerationQueueSection.tsx`。
2. `postQueries.moderationOverlays()` — `package/app/src/post/post.queries.ts`。
3. 按 realmModerationStatus 过滤 — `package/app/src/realm/pages/RealmPage.tsx:281`–`298`。
4. approve/remove → `PATCH /post/:unitId/moderation`（`package/server/src/post/post.api.ts`）。
5. 置顶：`PinboardAdminSection`（`package/app/src/pinboard/sections/PinboardAdminSection.tsx`）→ `PATCH /realm/:unitId/extra/pinboard`（`package/server/src/realm/realm-extra.api.ts`）。

**关键数据流**：`RealmPage`(manage) → moderation actions / pinboard → post.service / realm-extra.service。

**边界/权限/异常**：仅 moderator+ 审核；PENDING 受限可见；Remove 后普通用户隐藏；置顶有容量限制。

## 场景 14：社区规则与成员协议

**入口/触发**：加入需规则时弹 `RealmRuleDialog`；Manage → Organization 编辑规则槽。

**前置条件**：`ruleRequireOnJoin=true` 且指定规则 post。

**步骤**：
1. `JoinButton` 检查规则 — `package/app/src/realm/components/JoinButton.tsx:39`–`47`。
2. `realmRuleResolvedQuery()` 取规则 — `:44`–`47`。
3. `RealmRuleDialog` 显示并要求同意 — `:90`–`97`。
4. `acknowledgeRealmRule()` — `package/api/src/realm/realm.mutations.ts`，`POST /realm/:unitId/rules/acknowledge`（`package/server/src/realm/realm.api.ts:945`–`971`）。
5. join 时校验 RealmRuleAcknowledgement — `package/server/src/realm/realm.service.ts:601`–`617`。

**关键数据流**：`JoinButton` → `realmRuleResolvedQuery()`/`acknowledgeRealmRule()` → realm.api → 契约 `AcknowledgeRealmRuleInput`。

**边界/权限/异常**：规则来自特定 Post；改版需重新确认；确认永久保存；不确认不能加入。

## 场景 15：社区标签管理与应用

**入口/触发**：Manage → Organization 编辑标签树；主页 Tags 应用标签。

**前置条件**：owner/admin 编辑；成员可应用。

**步骤**：
1. 标签树编辑 `RealmManageEditors` — `package/app/src/realm/sections/RealmManageEditors.tsx` → `useUpdateRealmMutation()`（存 `Realm.extra.tagTree`）。
2. 标签应用 `RealmTagBrowser` — `package/app/src/realm/components/RealmTagBrowser.tsx` → `createRealmTagApplication()`（`package/api/src/realm/realm.mutations.ts`），`POST /realm/:realmId/tag-applications`（`package/server/src/realm/realm-tag-application.api.ts`）。
3. 投票 `castRealmTagApplicationVote()`（`package/server/src/realm/realm-tag-application-vote.mapper.ts`），成员权限（`realm.api.ts:118`–`140`）。

**关键数据流**：管理 `RealmManageEditors` → `updateRealm()`；应用 `RealmTagBrowser` → `createRealmTagApplication()`；投票 `castRealmTagApplicationVote()`。

**边界/权限/异常**：标签树仅 owner/admin；应用对成员开放、投票限成员；低分应用低于阈值隐藏（`realm.service.ts:99`–`100`）。

## 场景 16：社区 Wiki 区域

**入口/触发**：主页 Wiki 标签；创建页 wiki 模式。

**前置条件**：已创建 realm；Wiki 侧栏可使用自动页面列表、侧栏帖或分区导览。

**步骤**：
1. `RealmWikiTab` — `package/app/src/realm/components/RealmWikiTab.tsx` 加载 realm 下 Wiki 文档，并按 `wikiSidebar` 配置渲染侧栏。
2. 创建：`RealmCreatePage` wiki 模式 `WikiPostEditor` — `package/app/src/realm/pages/RealmCreatePage.tsx:41`–`42`、`:19`。
3. 提交创建 Post(PostKind.WIKI) 关联 realm。
4. 编辑：`package/app/src/routes/_editor/realm/$realmId/post/$postUnitId/edit.tsx`。

**关键数据流**：`RealmCreatePage`(wiki) → `WikiPostEditor` → `createRealmPost()` → post.service → 契约 `PostResponse`(WIKI)。

**边界/权限/异常**：Wiki 不要求独立 Zone；仅 owner/admin 创建编辑；支持版本/历史。

## 场景 17：用户的社区成员列表（个人页）

**入口/触发**：`/u/:userSlug/realms` 或 `/user/:userId/realms`。

**前置条件**：无特殊要求。

**步骤**：
1. `/u/$userSlug/realms` — `package/app/src/routes/_mainLayout/u/$userSlug/realms.tsx`。
2. `realmsByMemberQuery(userId)` — `package/api/src/realm/realm.queries.ts:115`–`121`。
3. 返回 RealmListResponse（仅有权查看的）。

**关键数据流**：`/user/:userId/realms` → `realmsByMemberQuery()` → `realmApi.byMember()` → 契约 `RealmListResponse`。

**边界/权限/异常**：私有社区不显示在他人列表；退出后消失。

---

## 数据模型与权限要点

- 关键契约：`RealmDTO`（`package/contract/src/realm/realm.ts`）、`RealmMemberDTO`（`package/contract/src/realm/publication.ts`）、`RealmMemberRole`（`package/contract/src/permission/realm-role.ts:3`–`8`）、`RealmExtraOkResponse`（`package/contract/src/realm/realm-extra.ts`）。
- 权限决策统一由 `governanceRoutePolicyService` 处理（`package/server/src/realm/realm.api.ts`）：创建（`:104`–`116`）、成员角色变更（`:73`–`102`）、标签投票（`:118`–`140`）、置顶（`:142`–`174`）、规则更新（`:176`–`199`）。
