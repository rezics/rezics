# Zone composition, aggregation, and theming decisions

Status: Accepted — implementation in progress

Owner: Domain

The factual basis (repository state, external platform evidence, research
literature, and rights verification) lives in
[zone-composition-and-theming-research-report.md](./zone-composition-and-theming-research-report.md)
and is not restated here. This document builds on the accepted contracts in
[filter-feed-and-zone-experience.md](./filter-feed-and-zone-experience.md)
and [filter-documents.md](./filter-documents.md) and changes none of their
invariants. Relationship to the dedicated Tag Path contract: §10.

## 1. Scope and positioning

A Zone is REZICS's declarative sub-site surface: configuration-driven
composition over the shared corpus, lighter than an embedded application
platform and more capable than a wiki skin. Communities that need people,
rules, and publication relations pair a Zone with a Realm (§7); the Zone
itself never grows membership or governance tables.

This program covers four increments on existing axes — list presentation,
derived query sources, page-level aggregate execution, and the theming
ladder — plus the showcase packs that prove the vocabulary. It introduces
no new composition paradigm.

## 2. Design principles

1. **Source × presentation orthogonality.** New capability lands as new
   `source` kinds or new presentation parameters on existing blocks, not
   as new block types per combination (Ghost Platform: rendering style is
   a parameter).
2. **Closed, non-Turing configuration.** Query capability stays inside the
   sparse `FilterDocument` / `SearchFeatureInput` contracts; no chained
   pipelines, no expression language (SMW/DPL evidence).
3. **Display copy is always a Unit reference.** Every new block member
   that carries user-visible text is a `labelUnitId`-style reference; no
   inline strings (existing `tabs`/`callout`/`media` discipline).
4. **Local validity stays local.** Depth, total Block count, and query-Block
   count live in each host policy and are enforced when that document is
   written. A document never becomes invalid because another independently
   stored surface is mounted beside it. Cross-surface work limits belong to
   the runtime compositor.
5. **Identity follows the narrowest useful scope.** A Block `_key` is
   stable and unique only among siblings in its containing array. Database
   resource IDs remain outside canonical document JSON. Execution uses a
   typed structural path, while theming uses explicit semantic hooks.
6. **Cacheability is a static property of a source.** Whether a block's
   result may be shared across viewers must be decidable from the persisted
   document alone; randomness is seeded so it caches (DPL `randomcount`
   evidence).
7. **Block-level fault isolation.** One failing query never fails a
   surface (Netflix row bulkhead).
8. **Canonical JSON storage; renderers evolve freely.** No stored render
   output, no byte-compare validation (Gutenberg evidence).
9. **Customization is declarative data; scripts never run in the host
   page.** Style-sheet customization is allowed only under the containment
   and review regime of §6.

## 3. Block vocabulary

### 3.1 List presentation profile

`unit-list` gains an optional `presentation` object:

- `itemSize: "sm" | "md" | "lg"` (default `md`) — density intent only;
  the client derives visible slide counts from container width. Persisted
  documents never store breakpoints or pixel values.
- `headingUnitId?` — optional Label Unit rendered as the section heading.
- `viewAllTarget?: NavigationTarget` — optional "more" affordance.

The carousel layout upgrades from the bare CSS overflow scroller to a
progressive shell: CSS scroll-snap as the no-JS base, enhanced after
hydration with the shared SharkUI Carousel (controls, indicators,
`slidesPerPage`/`slidesPerMove` computed from the container). The shelf
becomes a shared component in `libraries/ui/src/custom` reused by the
Realm pinned rail. Cards remain `UnitCard`/`Cover`.

### 3.2 Pinned sorts on Search-executing sources

`FilterDocument` deliberately owns no sort, so blocks cannot express "this
tab is newest-first" today. The pin lands inside the source variants that
actually execute Search, so sources with inherent curated order
(`units`, `collection`) cannot state one:

```
unit-list source: { kind: "search", feature, sort?: SearchSort }
derived query:    { feature, sort?: SearchSort }
feed block:       initialSort?: SearchSort
```

Semantics — a sparse narrowing of the server-owned sort policy, not a
client execution parameter:

- Write-time validation requires a registered `SearchSort` value and
  rejects `relevance` (query text is never persisted, and `relevance` is
  invalid without one).
- Execute-time resolution checks the pin against the server-owned policy
  for the executing surface. A pin the policy no longer offers resolves to
  the surface default and the block result carries an advisory, so
  persisted documents can never freeze the platform's ranking evolution.
- `unit-list` renders no sort control, so its pin is authoritative:
  runtime `state.sort` overrides are rejected for pinned sources. `feed`
  keeps its toolbar, so `initialSort` is only the default and the viewer's
  runtime choice wins.

No `expression` member ships with the pin: fixed variants belong in the
inline `filterDocument.where`, derived selections arrive as trusted
injections (§3.3), and a "pre-selected but adjustable controls" preset is
deferred until a product need exists — three constraint entrances is one
too many. The Filter document contract is unchanged.

### 3.3 Derived sources (selector → query, exactly one hop)

`unit-list.source` and `feed.feature` gain a `derived` kind:

```
{
  kind: "derived",
  select:
    { kind: "random-tag",
      from: { kind: "collection", collectionId }
          | { kind: "viewer-follows" },
      seed: { kind: "time-bucket", hours: 1 | 6 | 24 }
          | { kind: "request" } },
  query: { feature: SearchFeatureSource, sort?: SearchSort },
  fallback: { kind: "hide" } | { kind: "collection", collectionId }
}
```

Semantics:

- The selector resolves server-side to one Tag Unit; execution applies it
  to the query as a non-removable `tag` `SearchInjection` — the existing
  trusted-injection contract, no new predicate surface.
- **Bounded candidates.** `collection` candidates are the Collection's
  Tag-kind items; `viewer-follows` candidates are the viewer's followed
  Tag Units. Both are bounded, non-corpus sets. Initial tunable: the
  selector considers at most the first 1,000 candidates in stable keyset
  order; larger sets sample within that window. Selectors never execute
  against corpus-scale relations.
- **Seeded randomness.** `time-bucket` derives the pick from the
  server-owned resource context, canonical `BlockPath`, and bucket. For a
  Page this context already includes the route's Page Unit ID; for the main
  Dock it includes the Zone Unit ID and Dock slot. These values remain
  outside document JSON. The pick is deterministic within the bucket,
  reproducible, and shareable across viewers, so the block stays cacheable
  (this is the direct answer to the DPL `randomcount` prohibition).
  `request` re-samples per request and marks the block uncacheable; a
  "shuffle" affordance passes an explicit seed override.
- **Personalization is static.** `viewer-follows` marks the block
  personalized (never shared-cache eligible). For signed-out viewers the
  `fallback` applies: hide the block or substitute the named Collection
  selector.
- Presentation may reference the selection: `headingUnitId` accepts the
  sentinel `"selected"` slot on derived blocks so the heading renders the
  chosen Tag's localized title, composed with an optional prefix Label
  Unit. Dynamic headings therefore need no new i18n mechanism.

### 3.4 Tabs execution semantics

`tabs` remains a pure container. The aggregate execution contract (§4)
executes only the query blocks of the default (first) tab plus all
non-tab blocks; other tabs' query blocks return `skipped` and execute on
activation through the existing per-block endpoint. Clients may prefetch a
tab's blocks on hover/focus. The KadoKado-style section is therefore
`tabs` × (`unit-list` with a `search`/`derived` source and a pinned
`sort`) with no dedicated block type.

### 3.5 The `search` block

The dead `search` entry in `BlockTypeValues` becomes a real block: a
scoped search entry point rendering the standard Filter toolbar and query
input for a `SearchFeatureSource`, submitting to the Zone search surface.
It renders no inline result list in this release, so it adds no query
cost to aggregate execution. (Completing the contract was chosen over
removal because the Zone search surface already exists and the entry
point is the missing piece.)

### 3.6 Collection membership predicate

The Search field registry gains a `collection` membership field
("Unit is an item of Collection X"), compiled against `collection_item`
with its existing indexes, usable from Filter controls and injections.
This is distinct from the existing `UnitPredicate.collection` ("this Unit
is a Collection whose items match"), which keeps its semantics. Dynamic,
query-backed Collections remain out of scope, per the Collection schema's
standing note.

### 3.7 Query-block budgets

`BlockHostPolicy` gains `maxQueryBlocks`, counting blocks that execute
Search/Feed work (`feed`, `unit-list` with `search`/`derived` source,
future query blocks). Initial tunables, enforced at write time alongside
the existing depth/count rules:

| Host policy | maxQueryBlocks |
| --- | --- |
| Zone Page | 24 |
| Dock | 6 |
| Wiki Post Portable Text | 6 |

Wiki Posts already embed `unit-list` structurally; the budget makes that
existing capability safe rather than newly granting it. Existing
persisted documents are not retroactively invalidated; the budget applies
on the next write.

### 3.8 Block identity and execution addressing

`_key` is an array-member identity, following the same locality as a
renderer list key:

- every `blocks[]` requires unique Block keys among its direct children;
- every `columns[]` and `tabs[]` requires unique container keys among
  its own direct children;
- different arrays, nesting levels, documents, and mounted surfaces may
  reuse the same key;
- a document key, container key, and Block key never share an implicit
  global namespace.

Executable Blocks are addressed inside one loaded document by a typed,
keyed structural path rather than a bare Block key or array indexes:

```
BlockPath =
  [{ slot: "blocks", key: BlockKey },
   { slot: "columns" | "tabs", key: ContainerKey },
   ...,
   { slot: "blocks", key: BlockKey }]
```

Keyed paths survive sibling reordering. Moving a Block to another container
changes its path, which is a document revision change and is already covered
by revision binding. Page Unit IDs, Zone Unit IDs, and Dock ownership remain
in database rows and request context; they are never copied into Page or Dock
JSON. A renderer may carry that ownership in an in-memory envelope for
authorization, logging, cache partitioning, or seeded execution.

### 3.9 Ownership context is not Block identity

The aggregate and continuation routes obtain the owning Zone and Page from
their URL path and load the main Dock through that Zone. A request names an
executable Block only by its `BlockPath` inside that already selected document.
There is therefore no persisted or request-level
`{ documentKind, documentId, blockKey }` identity tuple, and no document UUID is
injected into Page or Dock JSON.

Page, Dock, Wiki, comment, and future recommendation documents validate their
own sibling arrays independently. Mounting them together does not cause a
second write validation. The runtime compositor may load Page and Dock together
to allocate a bounded execution budget and return results in separate `page`
and `dock` branches; that is scheduling, not cross-document identity or
validity. Comments remain a separate renderer and do not enter this aggregate.

## 4. Page aggregate execution

### 4.1 Contract

One new endpoint executes a rendered surface's eager query blocks in one
request:

```
POST /search/zones/:zoneId/pages/:pageId/execute
body: { pageRevision?, includeDock?: boolean = true,
        pageBlocks?: [{ path: BlockPath, state? }],
        dockBlocks?: [{ path: BlockPath, state? }] }
→ { pageRevision,
    page: { results: [{ path,
        outcome:
          { kind: "ok", items, nextCursor?, selected? }
        | { kind: "error", code }
        | { kind: "skipped", reason: "budget" | "inactive-tab" } }] },
    dock?: { results: [{ path, outcome }] } }
```

- **Persisted-query semantics.** The server resolves every executed query
  from the stored Page or Dock document; the request may only name a
  runtime-validated path inside the corresponding response branch and
  per-Block continuation state. Clients cannot inject queries, so the
  endpoint adds no new query attack surface and inherits each Block's
  existing authorization (hosting-Zone context enforced, viewer-relative
  predicates require the viewer).
- Omitted per-surface Block selections mean the default automatic candidates:
  all non-tab query Blocks plus the default tab's (§3.4). Explicit path lists
  serve tab activation and refresh.
- The Zone mounts the independently stored Dock as two presentation regions:
  top-level menu Blocks in the Zone header (including its mobile portal), and
  every other top-level Dock Block in a separate Dock composition region before
  Page content. Both regions retain `surface = dock`; they do not become Page
  Blocks and are not revalidated against the Page.
- `pageRevision` binds results to the document revision the client
  rendered; a mismatch returns the current revision so the client refetches
  the projection. `GET /zones/:zoneId/render` is unchanged and remains the
  cache-friendly projection read.
- **Dual cursors.** Each block result carries its own opaque `nextCursor`;
  in-block paging continues on the surface-owned routes
  `/search/zones/:zoneId/dock/block-executions`,
  `/search/zones/:zoneId/pages/:pageId/block-executions`, and their
  `feed-block-executions` counterparts. Those bodies contain only `path`,
  continuation `state`, an optional derived-selection seed, and localization
  hints. They contain neither a document discriminator nor client-supplied
  Filter injections.
  Derived blocks echo the `selected` reference (hydrated with the standard
  presentation projection).

### 4.2 Execution and isolation

The server fans out block executions in parallel with a bounded
concurrency and a per-block timeout (initial tunables: concurrency 4,
timeout 2 s). A block failure or timeout yields that block's `error`
entry; the surface response itself succeeds whenever the document resolves
(Netflix row-bulkhead behavior).

The runtime compositor, not a cross-document write validator, owns the
initial automatic-execution budget of eight. It collects independently valid
Page and Dock candidates, selects at most eight in stable tree order under a
deterministic Page/Dock fairness policy, and executes at concurrency four.
Unused allocation may be borrowed by the other surface; non-selected
candidates return `skipped` and remain available through explicit path
execution. API quota charges the selected count. Service admission is bounded
against database-pool headroom, and every underlying Search, Collection, and
hydration query consumes the same server-side deadline.

`inactive-tab` work starts automatically only when the lazy tab is activated.
`budget` work never starts automatically after the aggregate response: Search
and Feed retain their ordinary submit controls, while a Collection-backed list
shows an explicit load action. This preserves the eight-query request-path cap
instead of merely moving excess automatic work into follow-up requests.

Adding comments, recommendations, or another renderer therefore adds another
runtime contributor; it never creates a new persisted Page/Dock compatibility
invariant.

### 4.3 Caching posture

This release ships no shared result cache: every block execution is a
bounded index-backed query, and correctness never depends on caching. The
contract is nonetheless cache-ready: shared-cache eligibility is decidable
statically per block (§2 principle 5, §3.3), `time-bucket` seeds make
random blocks deterministic within a bucket, and canonical
`SearchFeatureInput` hashing already exists for keying. A shared TTL cache
for non-personalized blocks is a later, additive decision.

## 5. Workload assumptions and growth math

Recorded against the repository baseline of 500,000,000 rows per
corpus-scale relation, with 3,000,000,000-row estimates.

- **Read path.** One aggregate call = ≤ 8 block executions, each an
  existing bounded Search/Feed execution (candidate seed via selective
  indexes, `maxCandidatesScanned 4096`, page ≤ 20 for eager fills), run at
  concurrency 4. Cost scales with the number of blocks and the existing
  per-query bounds, not with corpus size; at 3 B Units the governing factor
  remains index selectivity of the underlying Search paths, unchanged by
  this program. Hydration is ≤ 8 × 20 presentations per call, within the
  existing batch-hydration shape.
- **Selectors.** Sampling executes only over bounded sets (Collection
  items of one Collection; one viewer's followed Tags), capped at 1,000
  candidates in keyset order — O(cap) index-only work independent of
  corpus scale. No `ORDER BY random()` over corpus relations exists or is
  introduced.
- **Write amplification.** Aggregate execution adds no persisted write path
  beyond ordinary document edits. In particular, there is no Zone-wide
  Block-key or eager-count projection and a Dock write never scans or
  revalidates the Zone's Pages.
- **Failure modes.** Per-block timeout/error degrades one block to a
  client-rendered empty/fallback state; the page never 5xxs for one block.
  API quota counts one unit per selected Block (initial tunable), while a
  separate service-wide admission gate prevents authenticated interactive
  traffic from exhausting the database pool.
- **Skew.** Popular Zones concentrate identical non-personalized block
  queries; the seeded determinism of §3.3 makes those results shareable
  the moment a shared cache is added, which is the designated relief valve
  if hot-Zone load becomes measurable. Thresholds: sustained p95 aggregate
  latency > 500 ms or a single Zone exceeding 100 aggregate calls/s
  triggers the caching decision.

### 5.1 Theme-control-plane capacity

Theme revisions are control-plane data, but they are not assumed to have a
fixed global bound. Capacity therefore covers both the expected paid-program
shape and the repository's 500 M/3 B corpus-scale baselines.

- **Cardinality and distribution.** The planning workload assumes one custom
  theme per 10,000 Units and 20 retained revisions per theme: 1 M revisions at
  500 M Units and 6 M at 3 B. The qualification fixture deliberately used a
  less favorable 100 revisions per theme: 100,000 revisions across 1,000
  themes, 3% in the active review queue, 10% approved across two contract
  versions, 87% terminal, and one asset binding for every approved revision.
  Collection and followed-Tag selector fixtures each contained 10,000
  candidates although execution returns at most 1,000. Collection membership
  additionally included a second 5,000-item overlapping Collection and
  100,000 background membership rows to qualify the `all-of` intersection
  under selective rather than toy-table conditions.
- **Reads and concurrency.** Viewer rendering is one revision-primary-key
  lookup plus a negative asset-validity probe bounded by the submission limit
  of 16 assets. Theme history and the human queue use UUID keyset pagination
  (queue response at most 100); contract revalidation uses keyset batches of at
  most 1,000, default 250. No offset or corpus scan is in a request or recurring
  path. Review workers must claim bounded queue pages and cap concurrent
  render jobs; the aggregate Page executor separately caps database work at
  four concurrent Blocks and reserves pool capacity for non-aggregate traffic.
- **Measured plans.** On 2026-08-26, PostgreSQL against disposable
  `rezics_atlas` with the distribution above used
  `collection_item_pkey` and `unit_follow_pkey` for the two 1,000-row
  selector reads (1.10 ms and 1.01 ms), and the Collection primary key on both
  sides of a 4,097-row bounded `all-of` intersection (2.91 ms). It used the
  partial review-queue index for 101
  rows (0.15 ms), the approved-contract index for a 100-row revalidation page
  (0.12 ms), the theme/history index for 100 rows (0.22 ms), and the revision
  asset primary key for a 100-revision batch (0.08 ms). These are warm-cache
  qualification numbers, not production latency promises. The reproducible
  `services-main:zone-composition:capacity` task requires both an explicit
  flag and a database named `rezics_atlas`, loads the skew, runs
  `EXPLAIN (ANALYZE, BUFFERS)`, and fails if any required index disappears.
- **Storage and write amplification.** With short fixture CSS, the revision
  heap measured 327.68 bytes/row and its required indexes 110.84 bytes/row.
  That fixed portion extrapolates to 219.3 GB at 500 M revisions and 1.316 TB
  at 3 B. Source plus transformed CSS is bounded at 128 KiB/revision; without
  compression, a 16 KiB combined working average adds 8.19 TB/49.15 TB at the
  two baselines, while the absolute CSS ceiling adds 65.54 TB/393.22 TB.
  Render evidence stores asset IDs and bounded findings, never screenshots
  inline. A submission inserts the heap row and the primary, theme, and one
  state-partial index entry, plus 0–16 asset rows with primary and
  reverse indexes. Three reviewer/audit indexes with no read path were removed
  after qualification; a future audit filter must justify and measure its own
  selective index.
- **Rates, skew, and backpressure.** The preview planning envelope is 100
  submissions/s globally at burst, including up to 12.5 MiB/s of maximum-size
  CSS before WAL and indexes. Sustained queue depth above 10,000, oldest-item
  age above 15 minutes, database-pool wait p95 above 50 ms, or review-query p95
  above 50 ms closes submission admission before workers or the database can
  be saturated. UUIDv7 keeps queue scans append/keyset friendly, but the newest
  B-tree leaf is a possible hot key; sustained write rate above 1,000
  revisions/s triggers the sharding cutover below rather than unbounded worker
  concurrency.
- **Maintenance and scale-out path.** The expected 1 M/6 M revision cases are
  roughly 16.8 GB/101 GB at the 16 KiB CSS average plus measured fixed bytes.
  Before any of 50 M live revisions, 2 TB table-plus-TOAST size, six-hour
  vacuum/backup maintenance, or the latency thresholds above is reached, move
  immutable source/transformed CSS to content-addressed object storage and keep
  hashes, contract/state, and bounded review metadata in PostgreSQL. Then hash
  shard revision/history rows by `theme_unit_id` and maintain a separate,
  bounded review-work relation keyed by state and UUIDv7 so global queue reads
  do not fan out across theme shards. Terminal rejected/killed payloads move
  through the same archival path. This cutover preserves point lookup and
  keyset complexity at 500 M and 3 B rows rather than relying on one
  single-node, multi-hundred-terabyte relation.

## 6. Theming ladder

Customization is a four-level ladder. Levels 0–1 are ordinary product
surface; level 2 is the paid, reviewed program; level 3 is deferred.
**Gating decision: every theming capability beyond level 0 ships behind
`platform.development_preview.access` and remains there even as other
Zone surfaces exit preview. This document intentionally contains the
complete level-2 design and its implementation is a required deliverable
of this program, but general availability is a separate, later decision
with the preconditions listed in §6.4.**

### 6.1 Level 0 — existing tokens

`ZoneThemeDocument` (`colorScheme`, `accent`, `density`) is unchanged and
remains the always-available baseline.

### 6.2 Level 1 — extended tokens and the theme gallery

- The token vocabulary grows by bounded, enumerated members (initial set:
  hero/banner asset reference, card radius scale, heading font scale,
  surface tint). Every token is a closed enum or a platform asset
  reference; free-form values are limited to the existing accent color.
- A curated gallery of platform-authored presets (token bundles) gives
  non-technical operators one-click identity, mirroring Shopify presets
  and Discord's structured cosmetics. Most Zones are expected to stay at
  this level permanently.

The hero token references an ordinary platform image asset that is `ready`,
`public`, undeleted, and has a banner presentation. It is not a private asset
and it does not pass the custom-theme human review queue. Public visibility is
required because a public Zone must be renderable without borrowing the
operator's authorization. The Zone write validates this one reference with an
indexed asset lookup; it does not inspect another composition document.

### 6.3 Level 2 — Zone Pro: reviewed custom style sheets

The Block model makes contract-stable semantic styling hooks possible.
`_type` is a class anchor; optional bounded `styleRoles` are author-owned
semantic selectors analogous to class tokens. Structural `_key` values are
editor/renderer identities and are deliberately excluded from the public
styling contract.

**Styling contract.** A published, semver-versioned document defines the
complete selector surface: `data-block-type` and optional
`data-style-role` tokens on every Block root; named parts per Block type
(`data-part="title" | "cover" | "meta" | …`), aligning with the
`data-scope`/`data-part` anatomy SharkUI's Ark base already emits; state
attributes (`data-appearance`, `data-layout`, `data-item-size`); optional
renderer-owned surface roles such as `data-zone-surface="page" | "dock"`;
and the published CSS custom properties that carry the level-0/1 tokens.
Style roles may intentionally match multiple Blocks and have no uniqueness
meaning. Everything outside the contract is
implementation detail and may change without notice. Renderer changes that
preserve the exported surface are contract-minor; removals or renames are
contract-major and trigger automatic revalidation of every approved theme.
An old-contract revision stops rendering immediately and falls back to level-1
tokens. The author grace period is a remediation and resubmission window, never
permission to keep stale CSS active. Platform base styles move behind
`@layer`/`:where()` so contract-compliant overrides need no specificity
escalation.

**Containment (architectural, before any review).**

- Theme style sheets are parsed to an AST at submission; every selector is
  scope-transformed under a Zone composition root
  (`[data-zone-theme-scope]`). Page and Dock each receive their own paint-
  contained root, including Dock content rendered through a portal. Only
  Zone-authored Page and Dock composition is inside custom-selector reach.
  Comments, the hero, the viewer override, and platform chrome —
  navigation, auth state,
  report and moderation affordances, content-rating and content-label
  markers, trust badges — render outside those roots and are structurally
  unreachable.
- Document-global CSS mechanisms are not containment-safe. Theme CSS may nest
  ordinary scoped rules in `@media`, `@supports`, and `@container`; cascade-
  layer declarations, keyframes, imports, fonts, and other global at-rules are
  rejected. Each selector is recursively inspected, so functional pseudo-
  classes cannot smuggle private class, ID, type, or attribute selectors.
- `url()` may reference only platform-hosted theme assets uploaded with
  the theme revision. No external origins: this removes third-party
  visitor tracking, attribute-probe exfiltration channels, and unmoderated
  imagery in one rule.

Here too, "theme asset" means a ready, public, undeleted asset owned by the
theme submitter and explicitly declared on that immutable revision. Human
approval applies to the complete theme revision and its rendered evidence; it
does not convert a private hero into a special platform-approved asset class.
- `content` string values are restricted (empty/none/counters); any other
  use is rejected or escalated to human review.
- Static accessibility lints reject focus-outline removal without a
  compliant replacement, unguarded large animations (missing
  `prefers-reduced-motion` handling), and token combinations that fail
  contrast thresholds.
- Size cap (initial tunable: 64 KB minified per revision) and complexity
  lints (no universal-selector descendant chains).
- Viewer sovereignty: a per-viewer "view in default theme" control is a
  hard requirement on every themed surface, and the platform holds a
  kill switch that force-reverts a theme revision to level-1 tokens.

**Theme as a Unit.** Custom themes are a new Unit kind (`zone_theme`)
with immutable revisions, standard localization for name and description,
ownership, and a review state on each revision. `ZoneThemeDocument` gains
an optional `custom` member referencing an approved
`{ themeUnitId, revisionId }`; the token members remain and act as the
fallback whenever the custom reference is absent, unapproved, or killed.
Reviewing themes (not Zones) is the unit-economics decision: one approved
revision installs into any number of Zones, enabling a reviewed theme
gallery/marketplace, with bespoke submissions as the premium tier.

**Review pipeline.** Automated first: AST static checks (scope, URLs,
properties, size), a render-farm pass producing breakpoint × color-scheme
screenshots of reference surfaces, automated contrast and layout-shift
budgets, and AI-assisted visual QA — then a human approval gate. Contract-
major bumps re-run the pipeline across approved revisions automatically.
Review capacity is funded by the paid tier; the paid gate also throttles
submission volume.

**Scripts.** JavaScript never executes in the host page under any tier.
This is a permanent decision, not a preview gate.

### 6.4 Level-2 preview-exit preconditions (separate future decision)

Level 2 may leave development preview only after: the styling contract has
survived one contract-major renderer cycle with automated revalidation;
the review pipeline meets agreed turnaround and rejection-quality targets;
billing/entitlement integration exists; the kill switch and viewer
default-theme control are verified in production; and abuse-response
runbooks are written. None of these are deliverables of the current
program beyond the pipeline itself.

### 6.5 Level 3 — app blocks (deferred)

Interactive third-party experiences, if ever needed, follow the sandboxed
iframe model (manifest, typed postMessage API, CSP, review). Out of scope
here; recorded so level 2 is never pressured into hosting script.

## 7. Community pairing

The recipe for interest communities ("a moe community", "a science-fiction
community") is composition, not new tables: a Realm owns people, rules,
publication, and Tag contexts; a paired Zone provides the composed surface,
scoping content through `realms` predicates in its Filter and citing the
Realm through the existing `localRuleRealmId`. Zone management delegation
uses the Unit access-grant vocabulary (new grants such as
`zone.pages.manage`, `zone.theme.manage`) rather than membership tables.
Zones never own members; Realms never own page composition.

## 8. Showcase program

Three packs in `rezics-showcase-packs` prove the vocabulary, one per Zone
archetype (the Reddit migration evidence motivates proving expressiveness
on flagship examples before broadening access):

1. **`hongloumeng` — full-corpus literary Zone** (replaces the earlier
   One Hundred Years of Solitude idea, which rights verification rules
   out). Chapters through the proven EPUB → Portable Text pipeline;
   character Entities with subject associations forming the four-family
   genealogies; poetry and location Tags plus curated Collections;
   edition variants (脂本/程本) as Unit variants/releases; wiki Posts with
   `wiki.navigation`; a Zone with home composition exercising carousel
   lists, a seeded `derived` poetry/character spotlight, and wiki
   navigation. Sources must be public-domain digitizations recorded in
   `rights.json` (modern critical editions' apparatus is excluded).
2. **`light-novel` catalog Zone** (KadoKado-style discovery archetype).
   Metadata-only catalog (no protected full text) exercising the tabbed
   latest/completed lists via `tabs` + pinned sorts, `derived`
   random-tag spotlights with `viewer-follows` and Collection fallback,
   and carousel density variants. Requires a serialization-status field on
   the catalog contract for the "completed" tab; that field lands with the
   pack.
3. **`vndb-v11` Zone extension** (database catalog archetype). Adds the
   Zone definition, home composition (developer/staff Entity rails,
   era-sliced lists), and content navigation to the existing source pack.
   Tag-hierarchy browsing consumes the implemented dedicated Tag Path
   contract described below.

## 9. Versioning

The new persisted contracts and public API (`presentation`, pinned
sorts, `derived`, `maxQueryBlocks`, sibling-local keys and `BlockPath`
execution, the aggregate endpoint, semantic `styleRoles`, the
`search` block completion, the `collection` membership field, the
`zone_theme` Unit kind, and the theme review pipeline) are significant
public-API and persisted-contract changes and therefore land in a
second-segment (MAJOR) RomVer release; purely internal steps (renderer
refactors, the shared shelf component) may ride third-segment releases.
Persisted document members are additive, but database enum/constraint
changes, generated API clients, and the aggregate protocol require an
explicit migration and coordinated cutover plan. Content-pack
`minRezicsVersion` on the new packs pins the first supporting release.

## 10. Relationship to Tag Path

Zone composition and the dedicated Tag Path domain are independent
workstreams. Zone aggregation, derived sources, theming, and showcase packs
depend on stable Unit, effective-Tag, Collection, follow, and content-pack
contracts. Tag-hierarchy blocks consume the final Tag Path and judgment
contracts documented in [tag-paths.md](./tag-paths.md) and preserve their
authority and provenance. They do not depend on a preview gate, legacy
Structure Unit, or vendor-specific migration.

## 11. Delivery roadmap

Each phase has an exit condition; a phase must not start before the
previous phase's exit condition holds. All phases run inside the existing
Zone development-preview gate; §6's theming levels 1–2 additionally stay
in preview after other surfaces exit (§6.4).

### Phase Z0 — presentation

`unit-list.presentation` (item size, heading, view-all), the shared
scroll-snap + SharkUI carousel shelf, Realm pinned rail reuse.
Exit: Zone and Dock carousels render through the shared shelf with
container-derived slide counts; workspace TypeScript checks and block
schema tests pass.

### Phase Z1 — aggregate execution

The `execute` endpoint, per-block isolation, `pageRevision` binding,
typed `BlockPath` addressing over sibling-local keys, runtime compositor
budgets, tabs `skipped` semantics, frontend adoption, per-Block quota
accounting.
Exit: the default Zone surface renders from one render call plus one
aggregate call; fault-injection tests show per-block degradation without
surface failure; duplicate keys in independent Page, Dock, and nested sibling
collections neither overwrite results nor trigger cross-document writes.

### Phase Z2 — query vocabulary

Pinned sorts on Search-executing sources, `derived` sources with seeded
selectors and fallbacks, the `collection` membership field, the completed
`search` block, `maxQueryBlocks` budgets.
Exit: a fixture Zone renders a KadoKado-style tab section and a seeded
random-tag rail; determinism-within-bucket and signed-out fallback are
covered by tests; budget violations fail document writes with actionable
errors.

### Phase Z3 — theming levels 0–1 and the styling contract

Extended tokens, the preset gallery, semantic
`data-block-type`/`data-style-role`/`data-part` export across Block
renderers, and the published styling contract v1.
Exit: a preset applies end to end in preview; the contract document is
versioned and its exported surface is asserted by renderer tests.

### Phase Z4 — Zone Pro pipeline (remains development preview)

The `zone_theme` Unit kind and revisions, submission AST
transform/containment, the automated review pipeline with human gate,
`ZoneThemeDocument.custom`, viewer default-theme control, kill switch.
Exit: a custom theme passes the pipeline and renders on a preview Zone
end to end. Explicit non-exit: general availability requires the separate
§6.4 decision.

### Phase Z5 — showcase packs

`hongloumeng`, `light-novel`, and the `vndb-v11` Zone extension, plus
bundle updates.
Exit: the bundle applies losslessly on a disposable fixture; each Zone
renders its complete composed surface through the aggregate path; i18n
policy checks pass for all pack Label Units.

## 12. Deferred

Out of scope until real demand or a separate decision: a shared result
cache for non-personalized blocks (§5 thresholds); entity-card (infobox)
and bounded relation-graph blocks (the likely next vocabulary additions
after showcase feedback); embedding `feed` blocks in Wiki Post Portable
Text; level-3 app blocks; theme marketplace payouts; Zone creation
leaving development preview (a product decision with its own abuse and
quota work); and dynamic query-backed Collections (excluded by the
Collection schema's standing note).
