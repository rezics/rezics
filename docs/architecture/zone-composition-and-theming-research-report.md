# Zone composition and theming research report

Status: factual research record. This document records repository state,
external platform evidence, research literature, and rights verification
gathered for the Zone sub-site program. It states facts and sources only;
the accepted design lives in
[zone-composition-and-theming-decisions.md](./zone-composition-and-theming-decisions.md)
and intentionally restates none of it.
Observation date: 2026-08 (repository state as of 2026-08-24).

## 1. Repository state

### 1.1 Zone and Realm boundary

Zone (`unit.kind = "zone"`) and Realm (`unit.kind = "realm"`) are parallel
products, not aliases. A Zone is a content surface: it stores one sparse
`filterDocument`, one `themeDocument`, an optional activity window, and an
optional `localRuleRealmId` (`services/main/src/services/database/schema/zone.ts`).
A Realm owns membership, immutable Rule revisions, publication relations
(`realm_unit`), pins, taxonomy, and Tag contexts
(`services/main/src/services/database/schema/realm.ts`). The only structural
link is the optional local-rule reference. Zones have no member, role, or
content-ownership tables; content scope is Filter matching with the hosting
Zone as an enforced execution scope
([filter-feed-and-zone-experience.md](./filter-feed-and-zone-experience.md)).

### 1.2 Composition contracts

- Zone Pages are Units (`zone_page`) whose localization `content` is a
  `UnitReferencedBlockDocument`; inline Portable Text is rejected at the
  root so reusable display strings are Unit references
  (`services/main/src/services/content-pack/documents.ts`,
  `libraries/block/src/validation.ts`).
- The shared block vocabulary (`libraries/block/src/blocks.ts`) defines:
  `portable-text`, `post-full-view`, `unit-ref` (appearance
  `inline | card | cover`), `unit-list`, `feed`, `menu`, `image`, `url-image`, `divider`,
  and the containers `columns`, `group`, `callout`, `tabs`.
- `unit-list` already separates data from presentation: `source` is
  `units | collection | search` and `layout` is `list | grid | carousel`,
  plus a `limit` of 1–100. The `search` source wraps a
  `SearchFeatureSource` (`global | zone | inline{filterDocument}`).
- `tabs` items and `callout` already reference display copy through
  `labelUnitId`. Ordinary localized copy for user-composed surfaces is carried by Label Units
  (`services/main/src/services/database/schema/label.ts`) resolved through
  `unit_localization` and the ordered `localizationLanguages` preference. Image-local
  alternative text and captions remain inline with their image Block.
- Host policies (`libraries/block/src/validation.ts`): Zone Pages allow all
  referenced block types at the root with `maxDepth 4` and `maxBlocks 250`;
  Docks allow a narrower set with `maxDepth 2` and `maxBlocks 40`; Wiki Post
  Portable Text already embeds referenced blocks — including `unit-list`
  with a `search` source — with `maxDepth 6` and `maxBlocks 500`. No policy
  today counts or limits query-executing blocks specifically.
- `BlockTypeValues` and every host policy list a `search` block type, but
  no `SearchBlock` schema exists in `blocks.ts` and the Zone renderer has no
  branch for it (`apps/web/features/zones/components/block-renderer.tsx`).
  This is a dead contract entry.

### 1.3 Query execution contracts

- `FilterDocument` is sparse (`categories?`, `where?: UnitPredicate`,
  `controls?`) and deliberately owns no sort, page size, field, or operator
  additions (`libraries/filter/src/search-feature.ts`;
  [filter-documents.md](./filter-documents.md)).
- `SearchFeatureInput` = `filterDocument` + `contexts` (max 4, unique
  kinds; `zone` context is enforced on Zone routes) + `injections` (max 50;
  a `tag` injection carries a trusted, optionally non-removable tag control
  value) + `state`. Sort lives in `SearchFeatureState` and is therefore
  request state: a persisted block cannot pin a sort today.
- Registered sorts (`services/main/src/services/search/field-registry.ts`)
  include `best`, `relevance`, created/updated/published time orders, and
  category-specific counters. No random or sampled order exists anywhere in
  the Search or Feed paths.
- Pagination is opaque keyset only; offset pagination is explicitly
  rejected (`services/main/src/services/search/service.ts`). Execution is
  bounded (`maxCandidatesScanned: 4096`, page size ≤ 100, result window
  10,000; `services/main/src/services/search/performance/policy.ts`), and
  totals may be lower bounds.
- The `UnitPredicate.collection` predicate tests whether the current Unit
  *is* a Collection with matching items
  (`services/main/src/services/filter/sql.ts`); no Search field or
  predicate expresses "Unit is a member of Collection X". Collection
  membership is served by `GET /collections/:id/items` (keyset). The
  Collection schema comment explicitly excludes dynamic, query-backed
  Collections from the current model
  (`services/main/src/services/database/schema/collection.ts`).
- Zone query execution is per block:
  `POST /search/zones/:zoneId/pages/:pageId/blocks/:blockKey/execute`, plus
  dock and feed-block variants and Zone filter execute/feed routes
  (`services/main/src/services/api/search/index.ts`). No endpoint executes
  several distinct block queries in one request. `GET /zones/:zoneId/render`
  aggregates the document projection (page, dock, navigation, references)
  but no query results.
- Batch hydration exists: `POST /units/presentations` accepts up to 100
  Unit ids.
- Follows are Unit-level (`unit_follow`,
  `services/main/src/services/database/schema/follow.ts`); Tags are Units,
  so a viewer's followed Tags are a bounded per-viewer set.

### 1.4 Presentation and caching state

- The SharkUI Carousel wrapper exists
  (`libraries/ui/src/ui/carousel.tsx`; Ark UI based, with `slideCount`,
  `slidesPerPage`, `slidesPerMove`, `spacing`, controlled `page`) and is
  used once, for Realm pinned content. The `unit-list` carousel layout in
  the Zone and Dock renderers is a CSS `grid-flow-col` overflow scroller
  without controls, snapping, or responsive slide sizing.
- `UnitCard` and `Cover` (fixed 3:4) are the shared cover-card primitives.
  Responsiveness relies on `useIsMobile()` (768 px) and Tailwind
  breakpoints; no container-query-driven shelf primitive exists.
- There is no Redis and no server-side query result cache; API quotas are
  Postgres-backed. HTTP caching is limited to assets and one documentation
  route.

### 1.5 Content-pack support and gaps

The content-pack pipeline (`services/main/src/services/content-pack/`)
imports Zones (`compiledZone` with `filterDocument`, `themeDocument`,
slug, optional local Rule Realm), Zone Pages (block documents validated
against the Zone Page host policy), page and navigation structures, wiki
Posts, chapter Posts, Entities, Tags, Labels, Collections, relations
(including subject associations with spoiler evidence), and top-level
slugs. Existing packs: `toaru-core` (catalog with two Zones and wiki),
`xu-zhimo` (EPUB → Portable Text chapters, 23 books, 389 chapters),
`vndb-v11` (visual-novel catalog; no Zone yet). `tagPaths`,
`tagPathApplications`, judgment evidence on `unitTags`, and
`entityMeasurements` are now persisted by the dedicated contracts in
[tag-paths.md](./tag-paths.md) and
[entity-tag-spoiler-and-measurement-decisions.md](./entity-tag-spoiler-and-measurement-decisions.md).

### 1.6 Gating

Zone creation, page creation, and page replacement additionally require
`platform.development_preview.access`
(`services/main/src/services/api/domain-extensions/index.ts`). The Zone
management surface exposes only `capabilities.canManage`; there is no
delegated management grant vocabulary for Zones yet.

## 2. External platform evidence

### 2.1 Fandom

- Portable Infoboxes replaced arbitrary wikitext/Lua infoboxes with a
  declarative XML vocabulary specifically so one definition renders on
  desktop and mobile; empty-source fields hide automatically; theming is
  constrained to attributes that emit CSS classes, and every sourced
  element emits a `data-source` attribute documented as a stable styling
  hook ([Help:Infoboxes](https://community.fandom.com/wiki/Help:Infoboxes),
  [Portability Hub](https://portability.fandom.com/wiki/Portable_Infoboxes)).
- DynamicPageList on Fandom is capped at 500 results, force-cached (1 hour
  versus the platform's 14-day page cache), and the official guidance is to
  avoid `randomcount` because random output cannot be cached, to avoid
  site-wide template embedding of queries, and to keep pages to one or two
  queries ([Help:DynamicPageList](https://community.fandom.com/wiki/Help:DynamicPageList)).
  DPL4 upstream defaults bound query time (10 s) and category counts
  ([Extension:DynamicPageList4](https://www.mediawiki.org/wiki/Extension:DynamicPageList4/en)).
- Community JavaScript is allowed only through a staff review queue;
  custom CSS is unreviewed but frequently breaks with platform skin
  changes.

### 2.2 Semantic MediaWiki and Cargo

Cargo stores template data in flat relational tables and measured 30–50%
faster than SMW's custom EAV-style store on equivalent queries; the
Gamepedia wiki farm migrated all SMW wikis to Cargo in 2018–2019 citing
slowness and server crashes
([performance testing](https://www.mediawiki.org/wiki/Extension:Cargo/Performance_testing),
[FAQ](https://www.mediawiki.org/wiki/Extension:Cargo/FAQ)). SMW's own
operations guidance documents single pages triggering thousands of
template and query expansions through template-formatted results, and adds
a Redis-backed query-signature cache as mitigation
([Speeding up SMW](https://www.semantic-mediawiki.org/wiki/Speeding_up_Semantic_MediaWiki),
[Query cache](https://www.semantic-mediawiki.org/wiki/Help:Query_cache)).

### 2.3 Reddit subreddit CSS removal

Reddit announced the removal of arbitrary subreddit CSS in April 2017,
citing that custom CSS did not render for the mobile majority, required
coding skill, and that "CSS causes us to move slow" — platform changes
risked breaking community styles. A moderator survey registered 83.9%
"unacceptable". The replacement was structured styling plus a first-class
widget system, and the rollout strategy was to reproduce flagship
highly-customized communities (r/overwatch, r/gameofthrones) in the new
system first
([The Verge](https://www.theverge.com/2017/4/25/15426568/reddit-ending-subreddit-css-customization),
[r/modnews follow-up](https://rareddit.com/r/modnews/comments/6auyq9/reddit_is_procss/)).

### 2.4 Airbnb Ghost Platform

Airbnb's server-driven UI system composes screens from *sections*
(self-contained blocks whose data arrives already localized and
formatted) arranged by *layouts*, over one shared GraphQL schema for
web/iOS/Android. Rendering style is a parameter on the section
(`SectionComponentType`), not a new data type; the component registry is
closed; complex interactive components remain fully client-implemented
escape hatches that the server only places
([A deep dive into Airbnb's server-driven UI system](https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5)).

### 2.5 Shopify Online Store 2.0

JSON templates are data files: `{ sections: {id → data}, order: [...] }`
with hard caps (25 sections per template, 50 blocks per section). Section
schemas declare `settings`, `blocks`, `presets` (required for the editor's
"Add section" flow), and `locales`
([JSON templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates),
[Section schema](https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema)).
Shopify Theme Store themes pass a mandatory review program with versioned
updates.

### 2.6 Notion

Every content element is a block (UUID, type, properties, child pointers,
parent pointer); databases separate a collection (schema) from views
(query: filter/sort/group/aggregation) over the same blocks. Page loading
(`loadPageChunk`) recursively chases block and record dependencies and
needs several cache layers to stay acceptable
([The data model behind Notion's flexibility](https://www.notion.com/blog/data-model-behind-notion)).

### 2.7 Netflix homepage (Lolomo)

The browse page is a list of lists produced by a BFF: one client request,
parallel server-side fan-out per row, row-level failure isolation (a
failed row is omitted, never a page error), and two independent opaque
cursors (vertical row paging, horizontal in-row paging). Row freshness
policy follows signal decay: rows built on slow-moving taste are
precomputed and cached (EVCache), session-reactive rows are computed at
request time. Hovering one card prefetches data for the whole row
([Netflix caching](https://netflixtechblog.com/caching-for-a-global-netflix-7bcc457012f1),
[architecture analyses](https://leetdezine.com/netflix/base-architecture-homepage-browse/)).

### 2.8 Bluesky feed generators

Custom feeds are external services that return a skeleton (post URIs) that
the AppView hydrates; selection and hydration are fully separated. The
Paper Skygest feed reports p75 generation latency over six seconds when
computing live, and therefore precomputes recommendations offline and
serves them from a store
([Custom feeds](https://docs.bsky.app/docs/starter-templates/custom-feeds),
[Paper Skygest, arXiv:2601.04253](https://arxiv.org/abs/2601.04253)).

### 2.9 Wikidata multilingual terms

Entity labels, descriptions, and aliases are stored per language and
resolved through per-user language fallback chains ending in a final
default ([Help:Multilingual](https://www.wikidata.org/wiki/Help:Multilingual),
[Language fallback notes](https://meta.wikimedia.org/wiki/Wikidata/Notes/Language_fallback)).

### 2.10 WordPress Gutenberg serialization

Blocks serialize into HTML comments inside `post_content`; on load the
editor re-runs `save()` and byte-compares output against stored markup,
flagging mismatches as invalid blocks that require user-facing recovery.
Markup changes therefore require maintaining `deprecated` migration
entries per block version
([Data flow](https://github.com/WordPress/gutenberg/blob/trunk/docs/explanations/architecture/data-flow.md),
[Edit/save validation](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/),
[WP Tavern on markup changes](https://wptavern.com/ask-the-bartender-what-happens-when-block-markup-changes)).

### 2.11 Third-party UI containment and paid customization

- Twitch Extensions run third-party interactive UI as sandboxed iframes
  with a manifest, CSP, and a mandatory review program; extension code
  never runs in the host page context.
- Discord monetizes profile and server cosmetics (Nitro) with entirely
  structured options and no style-sheet access. QQ空间's paid decoration
  system (黄钻) is a long-running paid page-customization precedent in the
  Chinese market. Discourse ships a versioned theme/theme-component system
  with a public ecosystem and periodic breaking-change announcements.
  Tumblr's arbitrary HTML/CSS themes lost relevance as traffic moved to
  feed surfaces where themes never applied.

### 2.12 Styling-hook conventions

Ark UI (SharkUI's base) renders `data-scope`/`data-part` attributes on
component anatomy as a designed styling surface; shadcn/ui added
`data-slot` attributes across primitives for the same purpose. Fandom's
`data-source` (§2.1) is the same pattern.

### 2.13 Documented CSS abuse classes

With style-sheet injection and no further containment, the documented
abuse classes are: UI redressing outside the intended scope (hiding or
overlaying host chrome; historically used on Reddit to hide voting and
report affordances); exfiltration and tracking channels through
attribute-selector plus remote `url()` probes, sharpened by `:has()`;
text injection through the `content` property (spoofed badges or system
copy); accessibility destruction (removed focus outlines, forced motion,
insufficient contrast); and per-visitor third-party request leakage from
any remote `url()`. CSS-only injection does not expose sessions or API
calls; those risks belong to script injection, which is a categorically
different surface.

## 3. Research literature

- Hwang, TeBlunthuis, et al., *No Community Can Do Everything: Why People
  Participate in Similar Online Communities*, CSCW 2022
  ([doi:10.1145/3512908](https://doi.org/10.1145/3512908)): members seek
  (a) specific content and discussion, (b) similar people, and (c) the
  largest audience; the three benefits conflict, so broad topics are
  served by clusters of overlapping specialized communities rather than
  one community.
- Hwang and Foote, *Why Do People Participate in Small Online
  Communities?*, CSCW 2021 ([arXiv:2108.04282](https://arxiv.org/abs/2108.04282)):
  small communities are nested niches embedded in larger platforms;
  specialization and the resulting information partitioning benefit both
  the niche and the host platform's overall engagement.

## 4. Rights verification

### 4.1 One Hundred Years of Solitude — in copyright

The Harry Ransom Center's digitized manuscript collection carries an
explicit "In Copyright" rights statement naming the Estate of Gabriel
García Márquez
([HRC record](https://hrc.contentdm.oclc.org/digital/collection/p15878coll80/id/595)).
First publication 1967; the author died 2014-04-17. Consequences: US
protection runs 95 years from publication (through 2062 for the Spanish
text; the 1970 English translation is separately registered and runs
later); Colombia protects life + 80 years (through 2094); life + 70
jurisdictions through 2084; life + 50 jurisdictions through 2064.
Full-text ingestion is not lawful in any target jurisdiction now or in
the foreseeable product horizon. Factual metadata (character names,
relations, publication facts) is not protected expression, so a
catalog/encyclopedia surface without the text remains possible.

### 4.2 Dream of the Red Chamber (紅樓夢) — public domain

Cao Xueqin died 1763; the printed 程甲本/程乙本 editions date to 1791–1792.
The base texts and the traditional commentary manuscripts (脂本 family)
are public domain in every jurisdiction. Public-domain digitizations
exist (Chinese Wikisource; Project Gutenberg hosts the Chinese text and
early English translations). Caution: modern critical editions add
copyrightable editorial apparatus and annotations; ingestion must use
public-domain digitizations, recorded per object in `rights.json`. The
work offers, as facts: 120 chapters (with an 80/40 authorship split),
several hundred named characters across four family genealogies,
substantial embedded poetry, named locations (大觀園), and a documented
edition-variant history — all usable for structure, relations, and
full-text showcase purposes.

### 4.3 Alternative candidates

The complete Sherlock Holmes canon is public domain in the US since
2023-01-01 (final 1927 stories) and earlier elsewhere (Doyle died 1930).
Other complete-corpus Chinese candidates (西遊記, 三國演義, 水滸傳) are
likewise public domain; they offer larger casts but flatter relational
structure than 紅樓夢's genealogies.

## 5. Reference interaction pattern

The KadoKado (台灣角川) homepage "最新作品" section, observed 2026-08,
is the concrete target pattern for list blocks: a tab strip
(最新連載 / 最新上架 / 完結作品) where each tab is a different query
variant over the same corpus, presenting a horizontal cover-card rail
(cover, title, author, one-line summary) with edge navigation arrows.
