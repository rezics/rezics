## Context

Rezics is moving toward a release-first content model. Release Units are the
real user-facing book, game, and media entries, while Work Units provide hidden
aggregation domains through `UnitWork`. The GAME/MEDIA backend proposal deferred
series because the hard part is not a label or route; it is deciding whether
series are public knowledge, how they store visible content, how they are
queried, and how they interact with work domains.

Shelves already provide user/system collection behavior with `ShelfUnit`,
manual ordering, collection interactions, and shelf work-domain reconciliation.
Series need some container-like behavior, but their product meaning is different:
series are authoritative catalog knowledge, not personal or community curation.
That means series structure changes must be history-bearing public knowledge,
while derived indexes and work-domain projection remain repairable projections.

A key constraint is that hidden Work Units are not complete display entities.
They may have abstract identity maintenance for grouping and admin use, but that
identity is not the same as ordinary release display. Work titles may still use
`UnitTranslation`, but those translations require Work-specific handling because
Work Units do not carry the full release/entity/credit/media surface needed to
render Series entries as real content. Therefore Series member content is
release-first: Series stores visible release Units and derives work-domain
membership from those releases.

## Goals / Non-Goals

**Goals:**

- Define Series as public-knowledge library infrastructure, not as a shelf kind.
- Allow `Series.kindKey` to describe precise grouping semantics such as book
  series, game series, film series, media series, franchise, and universe.
- Store Series display hierarchy and ordering in generic content structure.
- Store counted Series member entries as visible release Units.
- Allow nested Series references only as structural/cross-reference nodes that do
  not recursively contribute content membership.
- Add direct Series release indexing for lookup without making the index the
  hierarchy source of truth.
- Add derived `UnitWork(role = SERIES)` projection so work-domain pages can find
  related Series in the same way they can find related shelves.
- Define representative-release selection for editor flows that start from a
  work-level intent.
- Add frontend/admin editing expectations for Series management, Work abstract
  pages, Work maintenance metadata, and release edit flows.

**Non-Goals:**

- Do not implement a generic `UnitRelation` model.
- Do not use Shelf or `Shelf.kindKey = "series"` as the canonical Series model.
- Do not make hidden Work Units direct Series member entries.
- Do not model season groups, episode groups, volumes, discs, tracks, arcs, or
  source-specific ordering groups as Series kinds.
- Do not make nested Series inheritance transitive.
- Do not make Work Units normal public search result cards or slug-scoped public
  entries.
- Do not require Series pages, Work maintenance editors, or release edit UI to
  be visually complete in this change.

## Decisions

### Series Is Public Knowledge, Not Shelf Infrastructure

A Series is a catalog-maintained Unit with a Series extension row. It uses normal
Unit identity infrastructure for translations, aliases, tags, external refs,
history, and permissions.

```txt
Unit(type = SERIES)
  └─ Series(kindKey = book_series | game_series | film_series | media_series | franchise | universe)
```

Shelves remain collection and interaction infrastructure. A user can make a
shelf that resembles a series, but that does not make it public catalog truth.
Conversely, a Series can be discussed, edited, and reviewed as public knowledge,
but it does not inherit shelf progress, backlog, favorite, or arbitrary
collection semantics.

Alternatives considered:

- **Use `Shelf(kindKey = "series")`**: rejected because shelf membership is
  interaction/collection state, not authoritative public knowledge. Shelf also
  carries features Series does not need and lacks clear history semantics for
  catalog assertions.
- **Use a generic public collection model instead of Series**: deferred. The
  product vocabulary is Series, and precise grouping is better handled through
  `Series.kindKey`.

### Series Kind Is A Primary Semantic, Not An Exclusive Taxonomy

`Series.kindKey` describes the main public-knowledge grouping semantics of a
Series Unit. It is not exclusive; one work domain can be represented by releases
that belong to multiple Series Units with different kind keys.

```txt
Iron Man release
├─ film_series: Iron Man film series
├─ universe: Marvel Cinematic Universe
└─ franchise: Marvel
```

Initial kind keys:

- `book_series`: ordered or otherwise recognized book/work series.
- `game_series`: game series.
- `film_series`: film series.
- `media_series`: media-domain series that may include TV, anime, OVA, movie,
  special, or similar media releases.
- `franchise`: brand, IP, publishing-lineage, or commercial grouping.
- `universe`: shared fictional continuity, setting, or world grouping.

Season groups, episode groups, volume groups, disc groups, track groups, arcs,
and source-specific ordering groups are not Series kinds. They belong in content
structure node metadata or future content-structure variants.

### Series Member Content Is Release-First

Series content is stored as generic content structure, but counted member nodes
reference visible release Units.

```txt
Series Unit
└─ contentStructure
   ├─ member node(contentUnitId = release-a)
   ├─ member node(contentUnitId = release-b)
   └─ reference node(contentUnitId = nested-series-c)
```

The release node is the history-bearing public assertion that a concrete content
entry belongs to the Series. It is also the displayable entry. If an editor's
intent is work-level, the system must resolve that intent to a representative
release and store the release node.

Alternatives considered:

- **Allow Work Units as direct Series members**: rejected for this change because
  Work Units are hidden aggregation identities and do not have the full display
  surface needed for Series pages.
- **Store both Work and Release membership in Series**: rejected because it
  creates competing sources of truth. Work-domain association should be derived
  from release membership through `UnitWork`.

### Representative Release Selection Handles Work-Level Intent

Editors often think in works, not specific releases. The UI may offer a flow like
"add this work to Series", but the write still stores a release node. That flow
must select a representative release.

Selection should prefer releases that are best for display and cross-locale use:

1. editor-selected release, if explicitly chosen;
2. release marked primary/canonical for the work, if available;
3. release with the strongest translation coverage for supported locales;
4. release with stronger source evidence, cover, description, and external refs;
5. deterministic fallback by stable ordering.

The selected representative release can be changed later by replacing the Series
content node's release reference. This is a Series structure edit and enters
history.

### Nested Series References Are Structural, Not Transitive

A Series may contain another Series Unit as a reference/grouping node only when
needed for public display. That reference does not inherit child releases.

```txt
Marvel franchise
├─ reference node: Marvel Cinematic Universe Series
├─ member node: Iron Man release
├─ member node: Avengers release
└─ member node: Loki release
```

If Marvel franchise should count Iron Man as a member, Iron Man must be a direct
release node of Marvel franchise even if Marvel franchise also references the
MCU Series Unit.

This is a permanent product rule, not a v1 shortcut: Series containment is
structural, not transitive.

### SeriesContentIndex Is Direct Release Lookup Infrastructure

Series release lookup uses a derived direct index.

```txt
SeriesContentIndex
────────────────────────────────────────
seriesUnitId
releaseUnitId
contentNodeId
createdAt
updatedAt
```

The index answers direct lookup questions:

- Is this release directly present in this Series?
- Which Series directly contain this release?
- Which content-structure node caused the direct membership?

It does not answer ordering, hierarchy, inherited membership, or work-domain
membership. Those come from content structure and `UnitWork` respectively.

The index must not store path or depth. Those values would duplicate tree state,
create drift during node moves, and tempt consumers to treat the index as the
hierarchy source of truth.

### Series Projects Into Work Domains Through UnitWork

Series work-domain participation is derived from direct release member nodes.
When a direct release node belongs to a work domain, the Series Unit is
registered in that work through `UnitWork(role = SERIES)`.

```txt
Series content node -> release-a
release-a -> UnitWork(role = RELEASE, workUnitId = work-x)
=> UnitWork(seriesUnitId, work-x, role = SERIES)
```

Nested Series reference nodes are not recursively expanded. If a parent Series
should appear in a child work domain, the parent Series must directly contain a
representative release from that work.

This projection does not enter Series history. The history-bearing act is the
Series content-structure edit. `UnitWork(role = SERIES)` is a repairable index,
like shelf work-domain reconciliation.

### Work Pages Exist, But Work Interaction Is Guarded

Work pages may exist as `work/:unitId` abstract release-list surfaces. They are
useful for inspecting the hidden aggregation identity, release list, maintenance
history, work-domain diagnostics, and inherited metadata. They are not normal
book/game/media detail pages and they do not use slug lookup scope.

Work Units may need edit surfaces for abstract title or identity metadata
because work-domain grouping needs human-readable maintenance identity. That
identity may use `UnitTranslation`, but it must be treated as Work abstract
identity rather than ordinary release display metadata. Work translations can
label the aggregation domain, maintenance surfaces, and abstract work pages, but
they do not make Work Units direct Series members or ordinary content entries.

This does not make Work Units direct Series members.

The library content edit layout should expose:

- a Series management area for creating/editing Series and their content tree;
- a Work abstract page for hidden Work release-list and maintenance inspection;
- a Work maintenance edit area for hidden Work abstract identity metadata;
- a release edit Series section that supports adding the current release to a
  Series or adding the release's work through representative release selection.

Work routes, if later exposed, should use `work/:unitId` and should not enable
Work slug scope. Work Units remain excluded from ordinary library search result
cards.

Any future feature that allows direct user interaction with Work Units must be
treated as a separate design decision. This includes direct Work-targeted
reviews, posts, shelves, ratings, Series membership, follows, progress, or any
new relation whose target is the Work Unit instead of a visible release. Such a
feature must explicitly analyze whether the interaction is precise enough,
whether release context is lost, how history/search/community aggregation works,
and must be confirmed with a human before implementation.

## Risks / Trade-offs

- **Risk: Series becomes a second Shelf system** -> Mitigation: keep Series as
  public knowledge, require history for Series structure edits, and avoid shelf
  progress/collection semantics.
- **Risk: Release-first Series duplicates entries for works with many releases**
  -> Mitigation: use representative-release selection and allow replacement when
  a better display release is available.
- **Risk: Editors expect nested Series inheritance** -> Mitigation: document the
  contract comments clearly and show diagnostics when a parent Series references
  a child Series but does not directly contain expected child releases.
- **Risk: Work UnitTranslation is mistaken for release display metadata** ->
  Mitigation: treat Work translations as abstract identity only, keep Work
  routes unit-id based, disable work slug lookup scope, and keep Work Units out
  of ordinary search results and direct Series membership.
- **Risk: Work page existence causes accidental direct Work interaction** ->
  Mitigation: require separate human-confirmed design before any direct
  Work-targeted relation or interaction is implemented.
- **Risk: Index drift from content-structure edits or work merge** -> Mitigation:
  treat `SeriesContentIndex` and `UnitWork(role = SERIES)` as repairable derived
  projections with job-runner diagnostics.

## Migration Plan

1. Land or align with the `introduce-unit-work-domain` direction for `UnitWork`
   and generic `contentStructure` terminology.
2. Add contract literals, comments, DTOs, and validation for Series, Series
   kinds, release-first member nodes, direct release index rows, representative
   release selection, and `SERIES` work role.
3. Add database schema and migrations for Series extension and direct release
   index storage.
4. Generalize content-structure storage if current physical models remain
   book-specific.
5. Implement Series service writes so content-structure changes update history,
   direct release index rows, and derived work-domain projection.
6. Add representative-release selection and editor override support.
7. Add repair jobs for direct release index drift, work-domain projection drift,
   work merge/move, and search projection rebuilds.
8. Add API/client read paths for Series detail, direct release lookup, related
   Series by work domain, Work maintenance metadata, and release edit Series
   flows.
9. Keep existing shelves unchanged and do not auto-promote shelves into Series.
