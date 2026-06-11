---
title: Toaru wiki three-page replication in the factory scenario
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [factory, zone, seed]
---

## Why

The three huijiwiki Toaru screenshots in `.temp/example` (wiki main page,
分类:角色, 分类:术语) are a real, dense MediaWiki portal. Replicating them as the
`toaru-wiki` factory scenario gives `/z/toaru` a realistic, content-complete
demo and stress test of the zone section system: ratio columns, tabs,
collections, feed, and large richText fragments — using only existing
primitives and pure seed data.

Sources of truth (already on disk, do not re-fetch):

- 分类:角色 content — `.temp/example/huiji-characters/body.txt` (verbatim, lines
  21–1185) and `rendered.html` (main-character avatar grouping per series).
- Main page and 分类:术语 — the two full-page PNGs in `.temp/example`; crops at
  ~1700px width are fully legible (working crops in `.temp/example/crops/`).

## Durable constraints & decisions

- (comment) **Theme is out of scope.** No theme-v1 token changes, no renderer
  changes, no per-section styling. Visual chrome (colored title bars, series
  color bars) is theme territory and deliberately not attempted here; zone
  default styling applies. Section flavor titles (e.g.
  `旧闻慢报：此时正是展现之时——HEROS_CONGREGATE.`) carry the wiki feel instead and
  live in LABEL units used as `titleLabelUnitId`.
- (comment) **「走 post」for indexes.** The four giant character index tables,
  the subcategory lists, and both alphabetical page lists are UNLISTED WIKI
  fragment posts rendered via `richText` sections. Only seeded entities get
  markdown links; every other name stays plain text. Do not create 647
  entities.
- (comment) **Markdown envelope.** `createRezicsRenderer` is markdown-it with
  `html: false`: GFM tables, images, and links render; raw HTML does not. So:
  red text → bold, ruby annotations → parenthesized text, rowspan nesting →
  flattened table columns, 折叠/collapse and （上一页）（下一页） pagination →
  static text.
- (comment) **Feed approximation.** The 首页动态 box maps to a `feed` section
  with `feedKind: "updates"` (posts sorted by `updatedAt` desc).
  `createWikiScenarioPost` sets `updatedAt = publishedAt`, which is load-bearing:
  the scenario staggers `publishedAt` of the exact wiki posts named in the
  screenshot (一方通行(超能力), 无名杀手, 锅烧精密工业, 鲇鱼女卡罗琳, …) so the feed
  reproduces the screenshot order and relative ages (1h/4h/17h/23d before seed
  time).
- (comment) **Mock images only.** Every image is a deterministic
  `https://picsum.photos/seed/toaru-<name>/<w>/<h>` URL (schema requires
  https): hero banner + logo, ~20 entity avatars, book covers (via
  `withCoverUrl`, the `books.ts:129` pattern — not the Amazon list in
  `data.ts`), the 工作指南 illustration, and the six 相关站点 banners (markdown
  images inside the fragment). Named wiki users get `faker.image.avatar()`.
- (type) Zone page configs must parse against the existing zone config
  schemas — extend the `buildToaruZoneConfig` coverage in
  `package/server/src/db/factory/scenarios.test.ts` (`expectValidZoneConfig`).
- (test) Three pages exist with the expected slugs and section kind sequence
  (home replaced, characters replaced, terminology added; search/feed kept).
- (comment) **Language.** Replication fragments are zh-Hans only
  (`LANGUAGES.ZH_HANS`), verbatim from the simplified-Chinese source; the
  existing trilingual realm/zone/label units stay trilingual. Do not invent
  en/ja translations for the 200-entry lists.
- (comment) **3-column alphabetical lists** are a top-level `columns` section
  with three ratio-1 columns, one richText fragment per column; split letter
  groups to balance column heights like the original (角色: A–H over 3 columns;
  术语: A–F / F–K / K–Z approximately — follow the screenshot break points).
- Decision: clear cutover — the current home and characters page configs are
  replaced, not kept alongside (repo rename/cutover rule).
- Decision: counts and stats lines (134,715 次编辑 / 2,526 篇条目 / 6,747 张图片;
  「以下200个页面属于本分类，共647个页面」/ 共334个页面) are static fragment text,
  not live metrics.

## Page → section mapping (structure to build)

**Home (`/z/toaru`, slug `home`)**

1. `hero` — picsum banner + logo; CTAs: join realm, 施工计划表 link.
2. `richText` — hero welcome blurbs (left/right), stats line, QQ 群 line, red
   announcement (bold), nav row links (系列作品总览 • 某系列总时间线 • 规章制度 •
   相关群组).
3. `columns` ratio 7:3
   - main: `richText` 旧闻慢报 (5 dated news + 新闻存档 link) → `feed`
     (updates) 首页动态 → `collection` (list) 维基博客 (4 blog posts) →
     `richText` 模范页面 (木原唯一 excerpt + 查看全文 link to its wiki post).
   - side: `tabs` 作品更新 (4 tabs 魔禁/超炮/科心/暗少, each a `collection`
     display `covers` of that series' books) → `richText` 目前工作指南 →
     `richText` 相关站点 (banner images + social links).
4. `columns` ratio 1:1:1 — wiki footer (license blurb + 相关链接 / 站内链接 /
   友站链接).

**分类:角色 (slug `characters`, replaced)**

1. `richText` intro (seven series, names linked to seeded book/series units).
2. Five `collection` sections, display `avatar-wall`, one per series row of
   主要人物: Index 7 / Railgun 4 / Astral Buddy 4 / Accelerator 3 / Dark
   Matter 2 (exact roster from `rendered.html`).
3. `richText` 简明索引 (角色初登场索引 as GFM tables: 旧约/新约/创约/超炮各篇/外典…).
4. `richText` ×3 — 科学侧 / 魔法侧 / 其他势力角色索引 (flattened GFM tables).
5. `richText` 子分类 (11 subcategories grouped F/M/N/Y/势).
6. `richText` page-count line + `columns` 1:1:1 with three letter-group list
   fragments (A–H, 200 of 647 entries, verbatim from body.txt lines 977–1184).

**分类:术语 (slug `terminology`, new page)**

1. `richText` intro (`为术语页面添加模板:Infobox terminology 以增加分类。`) +
   子分类 (N: 能力, Q: 其他术语).
2. `richText` page-count line (200 of 334) + `columns` 1:1:1 with three
   letter-group term-list fragments (transcribed from the screenshot).

Nav: repoint `nav-terms` from the search page to the new terminology page;
keep everything else.

## Tasks

## 1. Content capture

- [ ] 1.1 Create `package/server/src/db/factory/toaru-content.ts` to hold the
      replication content (fragment markdown bodies, entity/book/user/label
      tables); `scenarios.ts` keeps orchestration only.
- [ ] 1.2 Transcribe the 术语 list (200 terms, letter groups) from
      `.temp/example/分类-术语-*.png` crops into the three column fragments.
- [ ] 1.3 Transcribe the home-page box texts from `.temp/example/魔禁维基-*.png`
      crops: hero blurbs, stats/announcement, 旧闻慢报 5 items, 维基博客 4
      titles + authors, 模范页面 excerpt, 工作指南 bullets, 相关站点 entries,
      footer link lists.
- [ ] 1.4 Convert the 角色 indexes from `huiji-characters/body.txt` into GFM
      markdown tables/lists (简明索引, 科学侧, 魔法侧, 其他势力, 子分类, A–H page
      list), linking only seeded entities.

## 2. Factory plumbing

- [ ] 2.1 `createScenarioEntity` (scenarios.ts:204): optional `avatar` input →
      `Entity.avatar`.
- [ ] 2.2 Add `createScenarioWikiUser` following the `seedUsers` cross-DB row
      pattern (`users.ts:130–190`: `seedAuthUser` + Unit + User +
      `bootstrapSystemShelves`) for the named editors 菌 / 数恶♪ / 簌 /
      上条-神净 / 某富香的亚雷斯塔 / 爱蜜禁的Drew / Xqbk.
- [ ] 2.3 `createScenarioBookUnit` (scenarios.ts:236): accept a cover URL and
      apply it via `withCoverUrl` (mirror `books.ts:129`).

## 3. Data definitions

- [ ] 3.1 Extend `TOARU_ENTITIES` with the remaining 主要人物 roster (~12 new:
      滨面仕上, 欧提努斯, 食蜂操祈, 白井黑子, 初春饰利, 佐天泪子, 帆风润子, 悠里千夜,
      最后之作, 埃斯特·罗森塔尔, 垣根帝督, 杠林檎) plus 木原唯一, 鲇鱼女卡罗琳,
      无名杀手, 锅烧精密工业 (faction); every entity gets a picsum avatar.
- [ ] 3.2 Extend `TOARU_BOOKS` to back the 作品更新 tabs with exact releases and
      dates (创约15 2026-05-09, 魔禁漫画33 2026-02-12, 心理掌握5 2026-02-25,
      暗少 vols, 超炮 vols); per-series grouping for the tab collections.
- [ ] 3.3 Wiki posts: one per new entity (木原唯一 body = the featured-article
      excerpt); 4 blog posts authored by the named users; staggered
      `publishedAt` for the 首页动态 posts (1h/4h/17h/23d before seed time).
- [ ] 3.4 Define the ~18 UNLISTED fragments (home: 7+3 footer; 角色: 7;
      术语: 4) in `toaru-content.ts`, zh-Hans only.
- [ ] 3.5 Add LABEL units for every section flavor title (旧闻慢报…, 首页动态…,
      维基博客…, 模范页面…, 作品更新…, 目前工作指南…, 相关站点…, 主要角色, 简明索引,
      子分类, series bar titles, tab titles 魔禁/超炮/科心/暗少).

## 4. Zone config

- [ ] 4.1 Rewrite the home page in `buildToaruZoneConfig` per the mapping
      above (hero, stats richText, 7:3 columns, footer columns).
- [ ] 4.2 Rewrite the characters page (intro, 5 avatar-wall collections, 4
      index richTexts, 子分类, 1:1:1 list columns).
- [ ] 4.3 Add the terminology page (slug `terminology`) and register it in
      `pages` with correct `position`; repoint `nav-terms` to it.
- [ ] 4.4 Update `addSpecialSeedTarget` notes so the seed report links all
      three pages.

## 5. Verification

- [ ] 5.1 Extend `scenarios.test.ts`: new config still passes
      `expectValidZoneConfig`; assert the three page slugs and their section
      kind sequences.
- [ ] 5.2 Run `task test`, `task format`, `task check:convention`.
- [ ] 5.3 Run `task seed:factory:fast`; verify `/z/toaru`,
      `/z/toaru/page/characters`, `/z/toaru/page/terminology` against the
      screenshots (user runs `task dev`; give them these URLs).

## Out of scope

- Any theme work: theme-v1 tokens, ZoneSectionShell/renderer changes,
  per-section accent (theme territory, separate effort).
- Interactive fidelity: collapse toggles, real pagination, live edit counts,
  red "wanted page" links.
- en/ja translations of replication fragments; real cover/avatar images.
- The other two snapshots (`fandom-index`, `huiji-novel`) and the remaining
  447 角色 / 134 术语 entries beyond the captured first pages.
- Creating an entity per indexed name (indexes stay as fragment text).
