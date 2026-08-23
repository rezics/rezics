# Zone composition, aggregation, and theming decisions

Status: Proposed — prepared for maintainer review

Owner: Domain

The factual basis (repository state, external platform evidence, research
literature, and rights verification) lives in
[zone-composition-and-theming-research-report.md](./zone-composition-and-theming-research-report.md)
and is not restated here. This document builds on the accepted contracts in
[filter-feed-and-zone-experience.md](./filter-feed-and-zone-experience.md)
and [filter-documents.md](./filter-documents.md) and changes none of their
invariants. Relationship to the VNDB v11 program: §10.

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
4. **Budgets are contract, not runtime surprises.** Query-block counts,
   depths, and page budgets live in host policies and are enforced at
   write time.
5. **Cacheability is a static property of a source.** Whether a block's
   result may be shared across viewers must be decidable from the persisted
   document alone; randomness is seeded so it caches (DPL `randomcount`
   evidence).
6. **Block-level fault isolation.** One failing query never fails a
   surface (Netflix row bulkhead).
7. **Canonical JSON storage; renderers evolve freely.** No stored render
   output, no byte-compare validation (Gutenberg evidence).
8. **Customization is declarative data; scripts never run in the host
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
- **Seeded randomness.** `time-bucket` derives the pick from
  `hash(zoneId, blockKey, bucket)`: deterministic within the bucket,
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

## 4. Page aggregate execution

### 4.1 Contract

One new endpoint executes a rendered surface's eager query blocks in one
request:

```
POST /search/zones/:zoneId/pages/:pageId/execute
body: { pageRevision?, includeDock?: boolean = true,
        blocks?: [{ blockKey, state? }] }
→ { pageRevision,
    results: { [blockKey]:
        { kind: "ok", items, nextCursor?, selected? }
      | { kind: "error", code }
      | { kind: "skipped" } } }
```

- **Persisted-query semantics.** The server resolves every executed query
  from the stored page/dock document; the request may only name block keys
  and per-block continuation state. Clients cannot inject queries, so the
  endpoint adds no new query attack surface and inherits each block's
  existing authorization (hosting-Zone context enforced, viewer-relative
  predicates require the viewer).
- Omitted `blocks` means the default eager set: all non-tab query blocks
  plus the default tab's (§3.4). An explicit `blocks` list serves tab
  activation and refresh.
- `pageRevision` binds results to the document revision the client
  rendered; a mismatch returns the current revision so the client refetches
  the projection. `GET /zones/:zoneId/render` is unchanged and remains the
  cache-friendly projection read.
- **Dual cursors.** Each block result carries its own opaque `nextCursor`;
  in-block paging continues on the existing per-block execute endpoints.
  Derived blocks echo the `selected` reference (hydrated with the standard
  presentation projection).

### 4.2 Execution and isolation

The server fans out block executions in parallel with a bounded
concurrency and a per-block timeout (initial tunables: concurrency 4,
timeout 2 s). A block failure or timeout yields that block's `error`
entry; the surface response itself succeeds whenever the document resolves
(Netflix row-bulkhead behavior). Initial eager budget: at most 8 query
blocks execute per aggregate call; documents whose eager set exceeds the
budget fail validation at write time, not at render time.

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
- **Write amplification.** None: the program adds no persisted write path
  beyond ordinary document edits; aggregate execution is read-only.
- **Failure modes.** Per-block timeout/error degrades one block to a
  client-rendered empty/fallback state; the page never 5xxs for one block.
  Backpressure inherits the existing API quota system; the aggregate
  endpoint counts as one quota unit per executed block (initial tunable)
  so it cannot undercut per-block quota accounting.
- **Skew.** Popular Zones concentrate identical non-personalized block
  queries; the seeded determinism of §3.3 makes those results shareable
  the moment a shared cache is added, which is the designated relief valve
  if hot-Zone load becomes measurable. Thresholds: sustained p95 aggregate
  latency > 500 ms or a single Zone exceeding 100 aggregate calls/s
  triggers the caching decision.

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

### 6.3 Level 2 — Zone Pro: reviewed custom style sheets

The block model makes contract-stable styling hooks possible: `_key` is a
locally unique instance anchor and `_type` a class anchor. The design
turns that observation into an explicit, versioned contract rather than
exposing renderer internals.

**Styling contract.** A published, semver-versioned document defines the
complete selector surface: `data-block-type` and `data-block-key` on every
block root; named parts per block type (`data-part="title" | "cover" |
"meta" | …`), aligning with the `data-scope`/`data-part` anatomy SharkUI's
Ark base already emits; state attributes (`data-appearance`,
`data-layout`, `data-item-size`); and the published CSS custom properties
that carry the level-0/1 tokens. Everything outside the contract is
implementation detail and may change without notice. Renderer changes that
preserve the exported surface are contract-minor; removals or renames are
contract-major and trigger automatic revalidation of every approved theme
with an author grace period. Platform base styles move behind
`@layer`/`:where()` so contract-compliant overrides need no specificity
escalation.

**Containment (architectural, before any review).**

- Theme style sheets are parsed to an AST at submission; every selector is
  scope-transformed under the Zone theme root
  (`[data-zone-theme-scope]`). Platform chrome — navigation, auth state,
  report and moderation affordances, content-rating and content-label
  markers, trust badges — renders outside that root and is structurally
  unreachable.
- `url()` may reference only platform-hosted theme assets uploaded with
  the theme revision. No external origins: this removes third-party
  visitor tracking, attribute-probe exfiltration channels, and unmoderated
  imagery in one rule.
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
   era-sliced lists), and structures to the existing pack. Tag-hierarchy
   browsing blocks wait for the VNDB v11 program's import landing (§10);
   the Zone ships without them first.

## 9. Versioning

The new persisted contracts and public API (`presentation`, pinned
sorts, `derived`, `maxQueryBlocks`, the aggregate endpoint, the
`search` block completion, the `collection` membership field, the
`zone_theme` Unit kind, and the theme review pipeline) are significant
public-API and persisted-contract changes and therefore land in a
second-segment (MAJOR) RomVer release; purely internal steps (renderer
refactors, the shared shelf component) may ride third-segment releases.
Everything is additive — nothing removes or rewrites an existing persisted
contract — so the release needs release-note documentation but no data
migration or cutover plan. Content-pack `minRezicsVersion` on the new
packs pins the first supporting release.

## 10. Relationship to the VNDB v11 program

This program and the VNDB v11 entity/tag program
([vndb-v11-entity-tag-research-report.md](./vndb-v11-entity-tag-research-report.md))
are independent workstreams sharing no schema changes. Zone composition,
aggregation, derived sources, theming, and the `hongloumeng` and
`light-novel` packs depend only on public contracts that exist today
(Tags as Units, the `tag` Search field over the effective-tag projection,
Collections, follows, content-pack Zone import); the VNDB program's
physical reshaping of tag storage preserves those contracts. The single ordering constraint: the
`vndb-v11` Zone's tag-hierarchy browsing blocks consume Tag Paths and
judgment evidence, which land with VNDB v11 Phase 0–1; that Zone ships
its non-hierarchy surfaces first and adds hierarchy blocks after that
landing. No phase below blocks on, or is blocked by, the VNDB roadmap.

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
eager-set rules, tabs `skipped` semantics, frontend adoption, per-block
quota accounting.
Exit: the default Zone surface renders from one render call plus one
aggregate call; fault-injection tests show per-block degradation without
surface failure.

### Phase Z2 — query vocabulary

Pinned sorts on Search-executing sources, `derived` sources with seeded
selectors and fallbacks, the `collection` membership field, the completed
`search` block, `maxQueryBlocks` budgets.
Exit: a fixture Zone renders a KadoKado-style tab section and a seeded
random-tag rail; determinism-within-bucket and signed-out fallback are
covered by tests; budget violations fail document writes with actionable
errors.

### Phase Z3 — theming levels 0–1 and the styling contract

Extended tokens, the preset gallery, `data-block-*`/`data-part` export
across block renderers, and the published styling contract v1.
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
