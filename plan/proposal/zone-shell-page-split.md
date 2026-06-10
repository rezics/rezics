---
title: Zone 拆表 — 殼三列 + ZonePage 行,開放 slug 頁面
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [zone, contract, server, db, api, app, factory, meili]
---

## Why

單一 `Zone.config` 信封把殼(boundary/nav/theme,每頁都要)和頁面(一次只
渲染一個)耦合在一行一列:任何頁面渲染都load全部頁面、任何 tab 保存都全量
寫(跨 tab lost-update)、頁面集合固定 `{home, search?, feed?}` 無法承載
wiki 門戶的自定義頁面(如 `分类:角色`),版本粒度過粗。沿**加載/更新邊界**
拆:殼拆三個 jsonb 信封列,頁面拆 `ZonePage` 行,得到 `zoneId + slug →
config` 的查詢形態。開發階段乾淨 cutover,factory reseed,無舊形態兼容。
依賴 `json-evolution-policy.md` 的 envelope 模塊(1.1)。

## Durable constraints & decisions

- 目標形態:(type)
  - `Zone` 殼:`boundary`(context + filters,`rezics/zone-boundary` v1)、
    `nav`(menus + header,`rezics/zone-nav` v1)、`theme`
    (`rezics/zone-theme` v1)三個 jsonb 信封列 + `homePageId` FK。
  - `ZonePage`:uuid PK、`zoneUnitId` FK(cascade)、`slug`
    (unique(zoneUnitId, slug))、`config`(`rezics/zone-page` v1,
    `{ sections: [...] }`)、`position`。
- 殼拆三列的理由:對應三個 manage tab,列級 UPDATE 消除跨 tab lost-update;
  每列獨立信封、獨立版本演進。(comment → db/schema/zone.ts)
- **nav 是 jsonb 列不是關係表**:菜單 ≤3 層遞歸樹、整樹加載、從不按節點
  查詢;header 與 menus 同住一列,`header.menuId` 校驗仍是信封內部事務。
  (comment)
- **section 不拆行**:tabs/columns 使 sections 為樹,永遠隨頁整載。(comment)
- home 不變量走 `Zone.homePageId` FK(改名安全、語義顯式),非保留字 slug;
  創建 zone 必帶 home 頁,禁刪 homePageId 指向的頁。(type + test)
- menu 的 `{kind: "zonePage"}` target 改按 **pageId** 引用(slug 改名不斷
  鏈);刪 page 時服務端校驗 nav 引用並阻止(報出引用位置),渲染端對懸掛
  引用降級隱藏作第二道防線。(test + comment)
- search/feed 特殊頁**消解**:page 一律純 section 容器;feed 走既有 feed
  section kind;search 是殼級內建路由(非 ZonePage 行)。將來若需頁面級
  特化,以加性 `kind` 字段演進。(comment + test:創建任意 slug 頁)
- section id 唯一性從全局收窄到**頁內**;section 執行 API 增加 page 參數。
  (type + test)
- 圖片全 URL 化:theme `logoUrl/bannerUrl/backgroundUrl`、hero
  `bannerImageUrl/logoImageUrl`、header `logoImageUrl` 為純 URL 字符串,
  schema 校驗僅 `https:`,不限域(社區可外鏈;CSP 另議)。裝飾圖不走
  IMAGE unit(IMAGE = 目錄作品,見 json-evolution-policy 4.2 的語義註釋)。
  (type + comment)
- `ZoneCollectionItem` 加可選 `displayUnitId`:渲染該 unit 的頭像/標題
  (entity 頭像經 `ZoneRefUnitSummary.imageUrl` 管道),點擊走 `target`
  (可指 wiki page)。加性可選字段——兼容紀律的第一個示範。(type +
  comment)wiki page 經 ContentDoc `afterMain` 的 `unit-ref` 指回 entity
  (底部卡片渲染),側欄 infobox 留給 doc-v2,不新造機制。(comment →
  link-target / section 契約)
- collection 新增頭像牆 display 變體(`分类:角色`「主要角色」形態)。(type)
- page = 佈局容器,沿「全編輯文本 ↔ 全數據驅動」光譜漸進遷移;「單
  richText 指向 wiki post」是 section 聚合的退化情形,不是並列模型。
  (comment → zone-page 契約模塊 JSDoc)
- Zone 表規模按 subreddit 量級(10⁵–10⁶)設想,不做小表假設;設計與表大小
  無關。(comment)
- grouped query、可摺疊 section、頁內 TOC 為已知詞彙缺口,本提案不實現。
  (comment → section 契約記賬)

## Tasks

## 1. Contract(@rezics/contract zone 模塊重構)

- [ ] 1.1 `config-v1.ts` 拆為 `boundary-v1.ts`、`nav-v1.ts`、`theme-v1.ts`、
      `page-v1.ts` 四個信封(經 envelope 模塊定義,各自升級鏈文件);刪
      `rezics/zone-config` 單體信封與 `zonePagesSchema` 固定鍵。
- [ ] 1.2 theme/hero/header 圖片字段 unitId → https URL(`t.String` +
      format/pattern);`ZoneCollectionItem` 加 `displayUnitId?`;collection
      display 加頭像牆變體;`ZoneLinkTarget.zonePage` 改 `pageId`。
- [ ] 1.3 DTO 重塑:`zoneDTOSchema` = 殼(boundary/nav/theme + 翻譯 +
      lifecycle + homePageId)+ 頁面清單(id/slug/position,不含 config);
      portal 響應 = 殼 + 請求頁 config + refUnits;page CRUD 輸入 schema;
      section-data 請求加 pageId。
- [ ] 1.4 zone i18n key(若 manage 頁面文案受影響)同步。

## 2. Server(db + 域)

- [ ] 2.1 `db/schema/zone.ts`:Zone 殼三列 + `homePageId`(FK → ZonePage,
      deferrable 或創建後置)+ 新 `ZonePage` 表;`task db:generate` 出
      migration(開發期直接刪舊 config 列,無數據搬遷)。
- [ ] 2.2 `zone.service.ts`:殼 hydrate(三列各自 parse);page CRUD(slug
      唯一、position 排序、禁刪 home、刪頁校驗 nav 引用並報引用位置);
      校驗遷移(section id 頁內唯一、menu 深度、ref 斷言、boundary 詞彙);
      section 執行按 (zoneId, pageId, sectionId) 尋址。
- [ ] 2.3 `zone.api.ts` + mapper:殼讀寫按列分端點(boundary/nav/theme 各自
      PATCH);page CRUD 路由;portal 路由帶 pageSlug;search 保持殼級內建
      路由。
- [ ] 2.4 meili `filters.ts`:boundary 來源從 `config.filters` 改
      `Zone.boundary` 列,編譯邏輯不變。
- [ ] 2.5 server 測試更新:zone.service.test、zone.mapper.test、
      zone.by-slug.test 對齊新形態;新增 home 不變量與刪頁校驗測試。

## 3. @rezics/api

- [ ] 3.1 `zone/zone.api.ts`、`zone.queries.ts`、`zone.mutations.ts`、
      `zone.keys.ts`:殼列端點、page CRUD、portal(slug, pageSlug)、
      section-data 帶 pageId;`useZoneBySlug` 對齊。

## 4. App(package/app/src/zone)

- [ ] 4.1 `models/zoneManageDraft.ts` 拆三個殼 draft(boundary/nav/theme)+
      page draft(單頁 sections);樹操作(menu/section)歸位;
      `zoneDetailRoutes`/`officialZoneRoutes` 加 pageSlug 段。
- [ ] 4.2 `ZoneManagePage` 重組:boundary(原 filters 歸此)/menus/theme tab
      按列保存;sections tab → page 管理(頁列表 CRUD + slug + 排序 + 選中
      頁編輯 sections)。
- [ ] 4.3 portal:`ZonePortalPage` 按 (slug, pageSlug) 取殼 + 單頁;menu
      渲染懸掛 pageId 降級隱藏;collection 渲染 `displayUnitId` 頭像 +
      頭像牆 display;theme/hero/header 圖片改 URL 渲染。
- [ ] 4.4 app 側測試(`zoneManageDraft.test` 等)對齊。

## 5. Factory 與收尾

- [ ] 5.1 `package/server/src/db/factory/zones.ts` 與 toaru-wiki scenario:
      產出殼三列 + 多 page 行(home + 自定義頁,如 characters),覆蓋
      `displayUnitId` 頭像牆與 URL 圖片。
- [ ] 5.2 `task seed:factory:fast` + `task test` + `task check:convention`
      全綠;`task knip` 清理拆剩導出。

## Out of scope

- grouped query、可摺疊 section、頁內 TOC、infobox 側欄(doc-v2 方向)。
- IMAGE unit 的上傳/作品庫產品功能;manage 編輯器 UI 改造
  (`zone-manage-editor.md`)。
- zone 列表/發現、權限模型變更。
- 任何舊 `rezics/zone-config` 數據兼容(開發期 reseed)。
