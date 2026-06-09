---
title: Zone Portal Redesign — Versioned Config, Section Primitives, Realm Context
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [zone, contract, comment, search, i18n, manage, factory]
---

## Why

Zone today cannot express its target product: a rezics-style fandom wiki portal
(Toaru wiki), a book zone, or a realm zone. The config is spread across six
JSON columns with a side-car integer version, three parallel section unions
(legacy `sections`, `pages` with 10 kinds, `wiki` with 7 kinds) and three
hardcoded template components; query-backed sections render as empty
`DeferredSection` shells because no real search-condition schema exists;
section titles force inline translation maps that bloat with every language;
zone title/description cannot be edited after creation
(`ZoneService.update()` takes no translations); the manage page is four raw
JSON textareas.

This plan rebuilds zone as a versioned single-document config (content-doc
envelope pattern), collapses sections to 6 content primitives + 2 containers,
adopts a zero-inline-text i18n model (LABEL units / content units / frontend
i18n keys), introduces a typed `ZoneSectionQuery`, gives zones a typed realm
interaction context with a comment context selector, adds a menu tree model
with a two-layer zone header, replaces the manage page with structured
editors, and ships a trilingual Toaru wiki factory scenario as the end-to-end
acceptance case. Development-stage clear cutover: no old-data or old-code
compatibility.

## Durable constraints & decisions

- `(comment)` **Zero-inline-text**: zone config JSON contains only ids and
  i18n keys, never human-language strings. Text resolves from three sources:
  platform strings (frontend i18n catalog), curated short labels (LABEL units
  via `UnitTranslation`), rich blocks (content units via
  `ContentTranslation`). The single deliberate exception is
  `external.text` on `ZoneLinkTarget`: a plain untranslated string (e.g. a QQ
  group number), never a translation map.
- `(type)` **Versioned envelope**: the whole config is one self-describing
  JSON document with `schema: "rezics/zone-config"` and a `version` literal
  inside the document, stored in a single `Zone.config` jsonb column —
  same mechanism as `contract/src/content/doc-v1.ts`. Version-per-file
  (`config-v1.ts`, future `config-v2.ts`), boundary schema is the union.
- `(test)` **Read wide, write narrow**: read paths accept every historical
  version and normalize through `upgradeZoneConfig()` before any business
  code; in-memory only the latest type exists. Write paths persist the latest
  version only and validate strictly (`additionalProperties: false`) — a
  deliberate difference from `contentDocWriteSchema`'s opaque acceptance,
  because zone config is admin config, not user content.
- `(type)` **Section primitives**: 6 content kinds (`hero`, `richText`,
  `collection`, `query`, `feed`, `stats`) + 2 containers (`tabs`, `columns`).
  Semantic variants ("latest", "popular", "recent wiki") are query presets and
  default-title i18n keys, never new kinds.
- `(test)` **Container nesting rules**: `columns` only at page top level;
  `tabs` allowed inside `columns` panes; no other container nesting (no tabs
  in tabs, no columns in anything). Menu tree depth ≤ 3. Section ids unique
  across the whole config. Validation rejects violations.
- `(type)` **Label resolution chains**: section title =
  `titleLabelUnitId` → kind-default i18n key. Menu node label =
  `labelUnitId` → target unit's translated title → `external.text`. Menu
  items pointing at a unit need no label config at all.
- `(test)` **Hero owns no text**: the `hero` section renders the zone unit's
  own `UnitTranslation` title/description; there is no separate title storage.
- `(comment)` **Authority vs context**: `Zone.ownerRealmUnitId` (column, FK)
  is permission authority only. `config.context`
  (`{kind:"global"} | {kind:"realm", realmUnitId}`) is interaction defaults
  only (section query inheritance, create-CTA target, comment selector
  default). They may differ: official zones are owned by the rezics realm
  with global context. `primaryRealmUnitId` is removed.
- `(test)` **Implicit boundary**: zone-level `config.filters` is an
  unremovable boundary on all zone query sections, search, and feed; section
  queries and user filters only narrow within it.
- `(type)` **`ZoneSectionQuery`** compiles only to fields the Meilisearch
  indexes can filter/sort (`content`/`posts` indexes); validation rejects
  unsupported fields. `realm: "context"` resolves to `config.context`;
  `languages: "viewer"` resolves to the reader's language candidate chain.
- `(test)` **Per-section lazy hydration**: portal read returns zone + batch
  ref-unit summaries; list data is fetched per section id with cursor. Only
  the active tab pane fetches initially; `loadMore` continues the cursor.
- `(comment)` **Menus live inside the envelope**, not separately persisted
  like `ContentStructure`: menus and the header/sections referencing them must
  change in one atomic versioned write. Borrow from the book TOC structure
  editor its interaction machinery (recursive tree, `number[]` path ops), not
  its schema (`title: string` would violate zero-inline-text;
  `contentUnitId`-only targets are too narrow).
- `(type)` **Comment context contract**: `CommentListQuery.context` is a
  three-state read selector:
  `{kind:"all"}` = unconstrained read across direct and all realm contexts;
  `{kind:"direct"}` = direct comments only; `{kind:"realm", realmUnitId}` =
  that realm's thread. `CreateCommentInput.realmUnitId: string | null` keeps
  write targeting simple: null is a *direct comment*, string is a
  realm-context comment.
- `(test)` **Comment context rules**: root comment context comes from the
  thread view's context Select (All → null); replies always inherit the parent
  comment's context regardless of the view. Create with a realm context
  requires that realm to be in the root unit's `UnitRealm` set and respects
  that realm's moderation policy. The All view shows a realm badge on
  realm-context comments.
- `(type)` **richText host**: a `POST` unit with `kind: "WIKI"` and
  `visibility: "UNLISTED"` ("zone fragment"). `(test)` UNLISTED fragments are
  excluded from wiki listings, query sections, and search, but render through
  `richText` and are editable with the standard wiki editor +
  `ContentTranslation` workflow.
- `(comment)` **Zones are subscribed, never joined**: zone grants no rights
  (authority inherits from the owner realm), so zone UI copy is 訂閱/subscribe;
  realm copy is 加入/join. A realm-context zone's "join the community" CTA
  deep-links to the context realm's join.
- `(test)` **Zone update edits identity**: update accepts a `translations`
  array and upserts `UnitTranslation` + `UnitSupportLanguage`; title/desc are
  editable after creation.
- `(comment)` **Template is dead as a runtime concept**: creation presets
  seed a starter config; afterwards everything is data. One section renderer,
  no template dispatch.

## Tasks

## 1. Zone contract module (`package/contract/src/zone/`)

- [x] 1.1 Create `package/contract/src/zone/link-target.ts`: `ZoneLinkTarget`
  union — `{kind:"unit", unitId}` | `{kind:"zonePage", pageId}` |
  `{kind:"external", url, text}`.
- [x] 1.2 Create `package/contract/src/zone/menu.ts`: recursive
  `menuNodeSchema` (`id`, optional `labelUnitId`, optional `target`, optional
  `children`; `t.Recursive` like `contract/src/content/structure.ts`), menu
  registry shape `Array<{id, nodes}>`, depth-3 cap and leaf/group rules
  documented for the validator.
- [x] 1.3 Create `package/contract/src/zone/section.ts`: shared base (`id`,
  `titleLabelUnitId?`, `limit?`, `emptyState?`), `ZoneSectionQuery`
  (`target: "unit"|"post"`, `types?`, `postKinds?`,
  `realm?: "context" | {unitIds}`, `tagUnitIds?`, `realmTagUnitIds?`,
  `subjects?: {entityUnitIds?, roles?}`, `targetUnitId?`,
  `languages?: "viewer" | Language[]`, `ratings?`, `sort`), display variants
  (`tiles|grid|list|carousel|covers|featured` for `collection`/`query`), and
  the 8 kinds: `hero` (showDescription?, bannerImageUnitId?, logoImageUnitId?,
  ctas?: ZoneLinkTarget-items), `richText` (contentUnitId), `collection`
  (items: `{target, labelUnitId?}`[], display), `query` (query, display,
  loadMore?), `feed` (feedKind?), `stats`
  (metrics: subset of `articles|members`), `tabs` (defaultTabId?, tabs:
  `{id, titleLabelUnitId?, sections}`[]), `columns` (sidePosition?, side,
  main).
- [x] 1.4 Create `package/contract/src/zone/config-v1.ts`: envelope
  `{schema: t.Literal("rezics/zone-config"), version: t.Literal(1), context,
  filters, menus, header: {menuId, logoImageUnitId?, searchPlaceholderKey?},
  pages: {home, search?, feed?}, theme}` with
  `additionalProperties: false` throughout; `ZoneBoundaryFilter` = query
  vocabulary minus sort. Carry over theme tokens/images/layout from the old
  `zoneThemeSchema`, dropping `navPosition`.
- [x] 1.5 Create `package/contract/src/zone/upgrade.ts`:
  `zoneConfigEnvelopeSchema` (union of versions), `parseZoneConfig()` +
  `upgradeZoneConfig()` chain (v1 = identity today, harness ready for v2),
  mirroring the doc-v1/doc-v2 file layout.
- [x] 1.6 Rewrite `ZoneDTO` in the new module: `unitId`, `ownerRealmUnitId`,
  `slug`, `name`, `description`, `translations` (full array for manage),
  `config` (latest type), `startsAt`, `endsAt`. Add create/update input
  schemas (update includes `translations`). Export portal/section-data
  response shapes (`refUnits` summary map; section items + cursor).
- [x] 1.7 Delete `package/contract/src/realm/zone.ts` (including
  `wikiZoneTranslatedLabelSchema`, both legacy section unions,
  `ZoneFiltersSchema`, `zoneConfigVersionSchema`); update
  `package/contract/src/index.ts` exports and all contract-internal imports.
- [x] 1.8 Contract tests (`config-v1.test.ts`, `menu.test.ts`,
  `section.test.ts`, `upgrade.test.ts`): nesting rules, menu depth, section-id
  uniqueness expectations, strict `additionalProperties`, upgrade
  normalization, zero-inline-text (no string-map fields anywhere in the
  envelope schema).

## 2. Comment context contract

- [x] 2.1 Update `package/contract/src/comment/comment.ts`:
  `commentListQuerySchema.context:
  {kind:"all"} | {kind:"direct"} | {kind:"realm", realmUnitId: string}`
  (All = unconstrained; direct = `Comment.realmUnitId IS NULL`; realm =
  equality filter),
  `CreateCommentInput.realmUnitId: string | null` (null = direct comment);
  document both semantics at the schema site.

## 3. Database schema

- [x] 3.1 Rewrite `package/server/src/db/schema/zone.ts`: keep `unitId`,
  `ownerRealmUnitId`, `startsAt`, `endsAt`, timestamps; add
  `config: jsonData().notNull()`; drop `filters`, `configVersion`, `pages`,
  `sections`, `theme`, `primaryRealmUnitId`, `template`, `styling`, `wiki`.
- [x] 3.2 `task db:generate` for the migration (no hand-authored SQL); update
  `package/server/src/db/schema/schema-exports.test.ts`.

## 4. Server zone domain (`package/server/src/zone/`)

- [x] 4.1 Rewrite `zone.service.ts` create/update: update accepts
  `translations` and upserts `UnitTranslation` + `UnitSupportLanguage`;
  reads run `parseZoneConfig()`/`upgradeZoneConfig()` before returning;
  writes validate the latest-version envelope strictly.
- [x] 4.2 Rewrite `validateZoneConfig()` over the envelope: typed ref
  assertions (LABEL for every `labelUnitId`/`titleLabelUnitId`, IMAGE for
  theme/hero images, POST kind=WIKI for `richText.contentUnitId`, REALM for
  `context.realmUnitId` and query realm ids, existence for menu/collection
  unit targets), container nesting + menu depth + section-id uniqueness,
  `header.menuId` resolves, query fields within the supported set.
- [x] 4.3 Replace `getWikiHomepageData()` and the wiki hydrators with generic
  hydration: `getPortal(unitId, lang)` → zone + batch ref-unit summaries
  (one query over all unitIds referenced by the config, with translations),
  and `getSectionData(unitId, sectionId, {cursor, lang})` → executes the
  section by kind (query → search, feed → feed service, collection → ref
  resolution, stats → aggregates). Tabs panes resolve through their contained
  section ids.
- [x] 4.4 Query compilation: extend `package/server/src/meili/search/filters.ts`
  (and reuse the zone-scope path in `federated.service.ts`) to compile
  `ZoneSectionQuery` → content/posts index filters + sort, intersected with
  `config.filters` as the unremovable boundary; resolve `realm: "context"`
  and `languages: "viewer"` (via existing language-resolution helpers).
  Exclude UNLISTED units from all query-section results.
- [x] 4.5 `stats` metrics: `articles` (count of WIKI posts in the context
  realm via `UnitRealm`, excluding UNLISTED fragments), `members` (context
  realm `memberCount`). No edits/images metrics in this plan.
- [x] 4.6 Rewrite `zone.api.ts`: `GET /zone/by-slug/:slug`,
  `GET /zone/:unitId/portal`, `GET /zone/:unitId/section/:sectionId`
  (cursor/lang query), `POST /zone/`, `PATCH /zone/:unitId` (with
  translations), `DELETE /zone/:unitId`; permission checks unchanged
  (owner-realm capability). Update `zone.mapper.ts` for the new DTO.
- [x] 4.7 Add a LABEL unit API for manage pickers, following domain
  conventions (`package/server/src/label/label.api.ts` + `.service.ts` +
  `.mapper.ts` or the existing unit domain if a list/create surface already
  fits): search LABEL units by name, create LABEL with multilingual
  translations. Mount from `package/server/src/index.ts`.
- [x] 4.8 Update/extend `zone.service.test.ts`: translations upsert on update,
  envelope validation cases (each nesting/ref violation), upgrade-on-read,
  section data execution per kind, boundary-filter intersection, UNLISTED
  exclusion.

## 5. Comment server behavior

- [x] 5.1 `package/server/src/comment/comment.service.ts` +
  `comment.api.ts`: list with `context.kind = "all"` = no realm constraint
  (plain `rootUnitId` query; no partition merging logic);
  `context.kind = "direct"` = `Comment.realmUnitId IS NULL`;
  `context.kind = "realm"` = equality filter.
- [x] 5.2 Create path: `realmUnitId: null` = direct comment; non-null
  validated against the root unit's `UnitRealm` set and the realm's
  moderation policy; replies force-inherit the parent's `realmUnitId`
  (reject or overwrite mismatched input — pick one and test it).
- [x] 5.3 `comment.service.test.ts`: All-mode unconstrained read returns
  direct + realm-context comments interleaved by sort; reply inheritance;
  UnitRealm membership validation; direct-comment creation.

## 6. Frontend API (`package/api/src/`)

- [x] 6.1 Rewrite `package/api/src/zone/`: portal query, per-section data
  query with cursor (infinite), create/update mutations with translations,
  keys per section id; drop dead query shapes.
- [x] 6.2 Update `package/api/src/comment/` queries/mutations for the new
  `realmUnitId` semantics (absent vs string; create with null).
- [x] 6.3 Add `package/api/src/label/` for LABEL search/create.

## 7. App portal rendering (`package/app/src/zone/`)

- [x] 7.1 Delete `templates/` (`default.tsx`, `book.tsx`, `wiki.tsx`,
  `types.ts`, stories) and legacy models (`zoneSections.ts`,
  `zoneManageDraft.ts` in its JSON-draft form); replace `ZoneHomePage.tsx`
  with a single `ZonePortalPage` that renders `config.pages.home.sections`.
- [x] 7.2 New section renderers under `components/sections/` for all 8 kinds:
  `hero` (zone unit translations + theme/hero images + CTAs), `richText`
  (ContentDoc render of the fragment unit), `collection` (display variants),
  `query` (per-section data query + loadMore), `feed` (existing feed
  components, zone scope), `stats`, `tabs` (lazy pane fetch), `columns`
  (side/main layout). Empty states and default titles from i18n keys.
- [x] 7.3 `ZoneHeader`: layer-2 zone header (zone logo, menu dropdowns from
  the menu registry, zone search); on scroll, sticky merged state absorbing
  the sidebar toggle + rezics mark on the left and the user area on the
  right; mobile drawer renders the same menu tree. Load the `rezics-design`
  skill when implementing; reuse theme tokens.
- [x] 7.4 `models/zoneMenu.ts`: menu tree model — label resolution chain
  (labelUnitId → target unit title → external text), projections (header
  bar/dropdowns, drawer, in-page `menu`-style rendering via a
  `collection`/menu section), href resolution for `ZoneLinkTarget` (unit
  detail routes, zone pages, external).
- [x] 7.5 Routes: keep `routes/_mainLayout/z/$slug/{index,search,manage}` and
  zone-framed detail routes; when `config.context` is a realm, "create
  wiki/post" CTAs link to `/r/$realmSlug/create?mode=wiki` (explicit realm
  route — interaction stays realm-routed); hero join-CTA links to realm join.
- [x] 7.6 Model tests: label/title resolution, menu projection + depth
  rendering, ZoneLinkTarget href shapes, query-section param building,
  context-CTA routing.

## 8. Comment context selector (`package/app/src/comment/`)

- [x] 8.1 Context Select component (shadcn-style Select, label "context"):
  options = All + the root unit's realms (from its `UnitRealm`-derived data);
  searchable when long; zone-context realm pinned first after All. Do not show
  direct-only in the normal selector; it exists as an API/test context, not a
  default user-facing mode. Default per surface: zone-framed routes →
  `config.context` realm, realm routes → that realm, direct unit routes → All.
- [x] 8.2 Thread view wires the Select to `CommentListQuery.context`
  (All → `{kind:"all"}`, realm option → `{kind:"realm", realmUnitId}`); All
  view renders a realm badge on realm-context comments.
- [x] 8.3 Composer: root comments take the Select's context (All → null);
  reply composers show the inherited context read-only.
- [x] 8.4 Component/model tests for defaults per surface, badge rendering,
  and write-context mapping.

## 9. i18n

- [x] 9.1 Add `"zone"` to `LAZY_NAMESPACES` in
  `package/i18n/src/namespaces.ts`.
- [x] 9.2 Add `zone.json` for all six locales under
  `package/i18n/locales/*/`: per-kind default section titles, load-more with
  `{label}` interpolation, tab "All", empty states, subscribe wording, stats
  labels. Comment-context strings (All / direct comment / context label) go
  in the namespace the comment feature already uses.

## 10. Manage UI rebuild (`package/app/src/zone/pages/ZoneManagePage.tsx`)

- [ ] 10.1 Replace the four JSON textareas with structured tabs: Profile,
  Pages & Sections, Menus, Theme, Lifecycle. Permission via existing
  `canManageZone`.
- [ ] 10.2 Profile tab: multilingual title/description editor (per-language
  rows over `translations`, add/remove language), context picker (global |
  realm with realm search), read-only owner realm + slug.
- [ ] 10.3 Sections editor: per-page section list with add/remove/reorder;
  per-kind config forms; query builder generated from the `ZoneSectionQuery`
  schema fields; container editing for tabs (panes) and columns (side/main)
  enforcing nesting rules client-side; LABEL unit picker with inline
  quick-create (multilingual names, via the label API); content-unit picker
  for `richText` (context/owner realm WIKI posts incl. UNLISTED fragments)
  plus a "create fragment" shortcut into the wiki editor preset to UNLISTED.
- [ ] 10.4 Menu tree editor: adapt the book TOC structure editor's tree
  interaction (path-based add/remove/move) to `MenuNode`; target picker
  (unit search / zone page / external URL+text); depth-3 guard.
- [ ] 10.5 Theme tab: token inputs and IMAGE unit pickers. Lifecycle tab:
  startsAt/endsAt (unchanged semantics).
- [ ] 10.6 Manage model tests replacing `zoneManageDraft.test.ts`: draft ↔
  envelope round-trip, client-side nesting guards, translation row editing.

## 11. Factory and seeds

- [ ] 11.1 Update `package/server/src/db/seed/infra/seed-official-zones.ts`:
  Book / Realms / Popular zones as v1 envelopes (hero + query sections with
  real sorts; global context), keeping the existing en/zh-hant/ja
  translations and deterministic slugs.
- [ ] 11.2 Rewrite `package/server/src/db/factory/zones.ts` fixtures to
  envelope-based generation exercising every section kind (including one
  tabs and one columns fixture).
- [ ] 11.3 Add a `toaru-wiki` scenario to
  `package/server/src/db/factory/scenarios.ts` (pattern:
  `wiki-zone-experience`): realm `r/toaru`; LABEL units（人物角色／名詞術語／
  機構組織／地點場所／事件記錄／時間線／魔法側／科學側）; ~10 ENTITY units
  (characters 上條當麻・御坂美琴・一方通行・茵蒂克絲・亞雷斯塔, locations
  學園都市・常盤台中學, factions 英國清教・學園都市暗部, event 大霸星祭) each
  with zh-hant/en/ja translations and a WIKI post with trilingual
  `ContentTranslation`; BOOK units for the latest-release rail (禁書目錄 LN
  incl. 創約 15, 超電磁砲, 心理掌握, 暗部少女共棲); UNLISTED fragment posts
  (welcome, spoiler notice, news, did-you-know) ×3 languages; zone config
  using every primitive — hero, then columns(main: notice richText, tiles
  collection, tabs(最新編輯 feed / 熱門討論 query / 新作 query), stats;
  side: menu, covers collection, did-you-know richText), header menus, theme
  tokens, `context: realm`.
- [ ] 11.4 Register the scenario, update `scenarios.test.ts`, and verify
  `task seed:factory:fast` + scenario runs end-to-end.

## 12. Cleanup and verification

- [ ] 12.1 Repo-wide sweep: no remaining references to
  `wikiZoneTranslatedLabel`, `ZoneFiltersSchema`, `template`, `styling`,
  `primaryRealmUnitId`, `getWikiHomepageData`, or the deleted template files;
  `task knip` clean.
- [ ] 12.2 Run focused tests (contract, server zone/comment, api, app
  models), then `task test`, `task check:convention`, `task check:tokens`,
  `task format:check`.
- [ ] 12.3 Hand the user verification URLs after `task dev`: `/z/toaru`
  (portal incl. header scroll behavior, tabs, comment selector on
  `/z/toaru/wiki/:id`), `/z/book`, `/z/realms`, `/z/toaru/manage`, with
  locale switching across zh-hant/en/ja.

## Out of scope

- Arbitrary user CSS/JS, reviewed theme packages, theme marketplace.
- `stats` metrics beyond articles/members (edits, images need event/asset
  aggregation that does not exist yet).
- Multi-realm zone context (single realm or global only; cross-realm
  aggregation is expressed per-section via explicit `realm.unitIds`).
- Wiki revision history / edit-activity surfaces beyond the existing feed.
- Comment thread cross-context merging logic beyond the unconstrained query
  (no dedup, no per-realm grouping UI).
- Backward compatibility for existing zone rows or old config shapes
  (development-stage cutover; factory reseed is the data path).
- Drag-and-drop polish in manage editors (explicit move controls suffice).
