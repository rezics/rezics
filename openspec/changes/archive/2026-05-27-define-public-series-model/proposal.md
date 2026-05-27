## Why

Series are currently treated as an unresolved follow-up from the GAME/MEDIA
backend work. The unresolved part is not whether a Series Unit can exist, but
whether series are authoritative public knowledge, how their visible content is
modeled, and how they participate in work-domain lookup without becoming a user
shelf or depending on hidden Work Units as displayable members.

This change defines Series as a public-knowledge content grouping backed by
history, release-first content structure, direct lookup indexes, representative
release selection, and derived work-domain projection.

## What Changes

- Introduce Series as a first-class public-knowledge Unit model, with a Series
  extension row and a contract-defined `Series.kindKey` taxonomy for
  `book_series`, `game_series`, `film_series`, `media_series`, `franchise`, and
  `universe`.
- Define counted Series content as release-first. Series content-structure nodes
  that represent actual members SHALL reference visible release Units. Hidden
  Work Units are not direct Series content members.
- Allow optional nested Series reference nodes only as structural/cross-reference
  nodes. Nested Series containment is not transitive and does not contribute
  inherited release membership, search projection, or work-domain projection.
- Add a direct-only `SeriesContentIndex` derived from direct release member
  nodes. The index exists for Series lookup and repair only; it has no ordering,
  hierarchy, path, depth, inherited membership, or work-domain authority.
- Project Series into work domains through `UnitWork(role = SERIES)` using only
  direct release member nodes and each release's canonical `UnitWork(role =
  RELEASE)` work. This mirrors shelf work-domain reconciliation but remains
  derived and repairable rather than a history-bearing source of truth.
- Add a representative-release policy for workflows that conceptually add a
  work to a Series. The write still stores a release node; the system selects or
  asks the editor to select the best representative release, preferring releases
  with complete translations and strong canonical/source quality.
- Clarify Work behavior required by editing and routing: Work pages may exist as
  `work/:unitId` abstract release-list surfaces, and Work titles may use
  `UnitTranslation` for abstract identity. Those translations require special
  handling and do not make Work Units ordinary library content entries or valid
  direct Series members.
- Add a guardrail that any future relationship or interaction that directly
  targets Work Units, rather than deriving through releases and `UnitWork`, must
  be designed explicitly and confirmed with a human before implementation.
- Distinguish Series from Shelf: Series is catalog-maintained public knowledge;
  Shelf remains user/system/community collection and interaction infrastructure.
- Exclude season groups, episode groups, volume groups, disc groups, track
  groups, arcs, and source-specific ordering groups from `Series.kindKey`. Those
  belong to content-structure node metadata or future structure variants.
- Add frontend/admin readiness requirements for Series management, Work
  maintenance editing, and release edit flows that can add either the current
  release or a representative release for the release's work.

## Capabilities

### New Capabilities

- `public-series-model`: Defines Series as a public-knowledge Unit extension,
  its kind taxonomy, governance semantics, relation to Shelf, and Work display
  boundaries.
- `series-content-structure`: Defines Series member content as direct
  release-first content structure, including non-transitive nested Series
  references.
- `series-content-index`: Defines direct Series release indexing derived from
  content-structure nodes, including lookup and repair behavior.
- `series-work-domain-projection`: Defines how Series Units enter work domains
  through derived `UnitWork(role = SERIES)` projection from direct release nodes.
- `series-editing-experience`: Defines frontend/admin editing flows for Series,
  Work maintenance metadata, and release-to-Series additions.

### Modified Capabilities

- None. This change defines new Series capabilities while depending on the
  `introduce-unit-work-domain` direction for `UnitWork` and generic
  `contentStructure` terminology.

## Impact

- Affected packages:
  - `package/contract`: Series kind literals, Series DTO/input schemas,
    direct release-index DTOs, `UnitWorkRole` extension, content-structure
    eligibility hints, representative-release DTOs, and contract comments
    documenting release-first and non-transitive Series semantics.
  - `package/server`: Prisma schema, migrations, Series service/API/mapper,
    content-structure integration, history writes, direct release index repair,
    representative-release selection, and `UnitWork(role = SERIES)`
    reconciliation.
  - `package/search`: Release search projection for direct Series metadata
    without emitting Work Units as ordinary search results.
  - `package/job-runner`: Repair jobs for Series content index drift,
    work-domain projection drift, work merge/move repair, representative-release
    diagnostics, and search rebuilds.
  - `package/api`: typed clients, query keys, and mutation/read helpers for
    Series content, representative release selection, and lookup.
  - `package/app`: library content edit layout integration for Series pages,
    Work abstract pages, Work maintenance editing, and release edit flows that
    add current release or representative release to Series. Full visual
    implementation is out of scope unless a later UI change opts in.
  - `package/admin`: admin/editor surfaces for public-knowledge Series edits,
    diagnostics, representative release review, and history review.
- Database impact:
  - Adds Series extension storage.
  - Adds direct Series release index storage.
  - Extends `UnitWork` role vocabulary with `SERIES`.
  - May require generalized content-structure storage if the current physical
    model remains book-specific.
- Backward compatibility:
  - Existing shelves remain shelves and are not migrated into Series.
  - Existing ad-hoc series-like shelf data is not automatically promoted.
  - Work Units remain hidden aggregation identities and search-hidden; release
    Units remain the real content entries and Series members.
- Dependencies:
  - This change depends on the `introduce-unit-work-domain` direction for
    `UnitWork` and generic `contentStructure` terminology.
