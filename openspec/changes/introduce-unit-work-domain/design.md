## Context

Rezics currently has `Unit.workUnitId` and work-link APIs that allow a release
Unit to point at a parent work Unit. Existing specs and code still imply that a
work can be a visible catalog object, and some book surfaces try to render a
work by selecting one release's content. That model is not usable for books at
scale: readers interact with concrete releases, but community, tags, search,
and recommendations must not split across every translation, edition,
publisher, or web/book variant.

The target product model is release-first:

```txt
Visible page / reading / shelf item / review target:
  Release Unit

Hidden grouping / inherited search / shared community:
  Work Unit through UnitWork
```

This means users normally open and interact with release Units. The hidden work
Unit behaves like an aggregation domain, but it is not a normal user-facing book
detail page. Work-level tags, aliases, community feeds, and language defaults
are inherited or resolved by release pages through the `UnitWork` relation.

The repo already has adjacent patterns:

- `UnitTag` attaches classification to a Unit.
- `RealmUnit` attaches a Unit to a realm feed/community, but its name is
  inconsistent with the `UnitX` relationship pattern.
- Search sync already denormalizes translations, aliases, tags, realms, and
  shelf membership into Meilisearch documents.
- The job-runner already owns CDC/outbox-backed search synchronization.

## Goals / Non-Goals

**Goals:**

- Introduce `UnitWork` as the canonical relationship between visible release
  Units and hidden work Units.
- Keep release Units first-class for pages, reading, shelves, reviews, posts,
  attribution, and content.
- Let release search inherit work-level tags and work-level searchable text
  without maintaining duplicate tags on every release.
- Make Meilisearch queries fast by denormalizing inherited work fields into
  release documents at indexing time.
- Group release search results by work so ordinary searches do not show every
  publisher/edition/translation as a top-level duplicate.
- Resolve book language switching through curated work-language defaults.
- Add `targetWorkUnitId` semantics so release-specific posts/reviews still
  appear in the shared work-domain community feed.
- Rename `RealmUnit` to `UnitRealm` for naming consistency.
- Define CDC/job-runner batch repair paths for work-tag fan-out and structural
  work-domain changes.

**Non-Goals:**

- Do not introduce a generic `UnitRelation` abstraction.
- Do not make hidden work Units the default user-facing book pages.
- Do not force every domain to be release-aware. Books are the primary target;
  games/media may continue to behave as single visible Units until product
  requirements say otherwise.
- Do not require synchronous Meilisearch consistency after work-tag or
  work-domain changes.
- Do not solve full content graph generalization in this change beyond defining
  the required integration boundary for release-aware book content.
- Do not introduce local/offline client storage or optimistic workflows.

## Decisions

### Use `UnitWork` As A Dedicated Relationship Model

Add a work-specific relationship table named `UnitWork`.

```txt
UnitWork
────────────────────────────────────────────
unitId             visible release/member Unit
workUnitId         hidden work Unit
role               PRIMARY | RELEASE | EDITION | TRANSLATION | VOLUME | DERIVED
language           optional content language hint
rank               work-local display rank
displayPolicy      PRIMARY | SECONDARY | HIDDEN_BY_DEFAULT
createdAt
updatedAt
```

`UnitWork` is canonical. `Unit.workUnitId` may remain during migration as a
denormalized shortcut, but new behavior must read the relationship semantics
from `UnitWork`.

Alternatives considered:

- **Keep only `Unit.workUnitId`**: too weak for language defaults, rank,
  display policy, role, and future migration. It also hides the relationship
  behind a generic column name that call sites misuse.
- **Use `WorkDomain` / `WorkCluster`**: good conceptually, but naming pushes the
  system toward a new generic domain abstraction. `UnitWork` fits the existing
  `UnitTag` relationship style and is easier to enforce.
- **Use a generic `UnitRelation`**: rejected for this change. Realm, tag, and
  work relations have different product semantics, write paths, permissions,
  and projections.

### Keep Hidden Work Units But Stop Treating Them As Normal Detail Pages

A hidden work Unit is still a Unit so existing identity, slug, tag, alias,
history, attribution, and permission infrastructure can be reused. However, the
primary user-facing catalog page for release-aware books is a release Unit.

Release pages may show work-domain content:

```txt
Release page
├─ release metadata/content
├─ inherited work tags
├─ work-domain discussion feed by default
├─ exact-release filter
└─ language switcher resolving through UnitWorkLanguageDefault
```

Work Units may have admin/editor surfaces, but they are not the ordinary public
book detail destination.

### Add Work-Language Defaults Outside `UnitTranslation`

Language switching is a product decision, not a translation text field. Add a
dedicated default table:

```txt
UnitWorkLanguageDefault
────────────────────────────────────────────
workUnitId
language
unitId             primary release for this work/language
source             CURATED | SYSTEM | VOTE | FALLBACK
createdAt
updatedAt
```

Resolution order:

1. User preference for `(viewer, workUnitId, language)`, if a later change adds
   it.
2. `UnitWorkLanguageDefault(workUnitId, language)`.
3. Highest-ranked public `UnitWork` member that supports the language.
4. Current release when no better same-work language target exists.
5. No content state.

`UnitTranslation.sourceReleaseUnitId` is renamed to `sourceUnitId` and no longer
owns language-default release selection.

### Store Release Interactions Precisely, Aggregate Through `targetWorkUnitId`

Posts, reviews, shelf projections, and search documents need both precise and
folded targets:

```txt
targetUnitId      exact release/work/post target
targetWorkUnitId  hidden work Unit for aggregation, if applicable
```

Default release pages show work-domain community content. Exact-release filters
remain available by filtering `targetUnitId = currentReleaseId`.

### Denormalize Inherited Work Tags Into Release Search Documents

Meilisearch must not query PostgreSQL at request time to expand work tags. The
content search document for a release includes:

```txt
workUnitId
searchGroupId
ownTagIds
workTagIds
allTagIds
ownTagLabels
workTagLabels
allTagLabels
displayPolicy
releaseRank
primaryForLanguages
```

Tag filtering uses `allTagIds`, which makes work tag inheritance a normal
Meilisearch filterable array operation. Display can still distinguish whether a
tag came from the release or the work.

### Group Search Results By Work

Ordinary content search should avoid showing many same-work releases at the top
only because the work inherited the same tag. Search response assembly groups
items by:

```txt
searchGroupId = workUnitId ?? unitId
```

The default response returns the best visible release for each group and exposes
collapsed alternatives. Queries that explicitly hit release-specific fields
such as publisher, ISBN, source site, format, or exact language MAY expand more
release rows.

### Use CDC / Job-Runner For Fan-Out And Repair

Expected release count per work is about 200. That makes work-tag fan-out
practical if it happens in search sync jobs rather than user request paths.

Events that enqueue release document rebuilds:

- `UnitTag` changed on a hidden work Unit: rebuild all active release documents
  for that work.
- `UnitTag` changed on a release Unit: rebuild that release document.
- `UnitWork` inserted/updated/deleted: rebuild the affected release document and
  relevant grouped search metadata.
- `UnitWorkLanguageDefault` changed: patch/rebuild affected work members for
  `primaryForLanguages`.
- Work alias/translation/searchable metadata changed: rebuild release documents
  inheriting those work fields.
- Work merge/split/admin repair: enqueue a bounded batch repair job.

Batch handlers should process work members in pages and be idempotent. The
initial target limit is 200 release members per work; higher counts are allowed
only through batch processing and diagnostics should flag unusually large work
domains.

### Rename `RealmUnit` To `UnitRealm`

The relationship naming convention becomes:

```txt
UnitTag
UnitRealm
UnitWork
```

The rename is a clear internal cutover because the project is still in
development. It should be phased in tasks to keep migration readable, but this
change owns the naming decision.

## Risks / Trade-offs

- **Risk: Work Units remain accidentally visible as book detail pages** →
  Mitigation: add route/search/display requirements that hidden work Units are
  not ordinary public release results.
- **Risk: Inherited tag projection becomes stale after work tag edits** →
  Mitigation: CDC/job-runner rebuilds all work member documents, with drift
  repair and eventual consistency messaging in admin diagnostics.
- **Risk: Grouped search hides a release the user expected to see** →
  Mitigation: return collapsed alternatives and expand for explicit
  release-specific filters.
- **Risk: `UnitWork` and `Unit.workUnitId` drift during migration** →
  Mitigation: backfill, dual-read assertions, consistency checks, and a later
  decision on whether `Unit.workUnitId` stays as a denormalized shortcut.
- **Risk: `RealmUnit` rename makes the change noisy** → Mitigation: keep it in
  its own task phase and avoid changing realm behavior beyond naming.
- **Risk: Book language switching chooses a poor default release** →
  Mitigation: make defaults curated and editable, with deterministic fallback
  order and visible secondary release selector.
- **Risk: Work-level tags over-apply to release-specific searches** →
  Mitigation: store `ownTagIds`, `workTagIds`, and `allTagIds` separately so UI
  and ranking can distinguish inherited vs release-local matches.

## Migration Plan

1. Add contract types and Prisma models for `UnitWork` and
   `UnitWorkLanguageDefault`.
2. Backfill `UnitWork` from existing `Unit.workUnitId`.
3. Add consistency checks that detect drift between `Unit.workUnitId` and
   `UnitWork`.
4. Rename `RealmUnit` code/schema/API names to `UnitRealm` in a focused phase.
5. Rename `UnitTranslation.sourceReleaseUnitId` to `sourceUnitId` and move
   language default behavior to `UnitWorkLanguageDefault`.
6. Add `targetWorkUnitId` projection to post/review creation and search sync.
7. Extend search document contracts and Meilisearch filterable attributes.
8. Implement inherited work tag/search projection and grouped result assembly.
9. Add job-runner handlers for work-tag fan-out, `UnitWork` changes,
   language-default changes, and repair/backfill jobs.
10. Update book release selector and language switcher to resolve through
    `UnitWorkLanguageDefault`.
11. Update shelf rendering to store release Units and group by work when
    rendering.
12. Rebuild Meilisearch indexes and run drift repair diagnostics.

Rollback strategy:

- Keep `Unit.workUnitId` populated during the first implementation phase.
- Search can fall back to non-inherited release documents if inherited work
  fields are disabled.
- UI can fall back to current release selector behavior if language defaults are
  missing.
- The `RealmUnit` rename is not independently rollback-friendly after migration;
  schedule that phase only after the `UnitWork` design is accepted.

## Open Questions

- Should hidden work Units have a dedicated status/visibility flag, or is
  visibility controlled only by route/search policy?
- Should `UnitWork` support multiple work memberships for rare cross-over cases,
  or should a release belong to exactly one work domain in v1?
- Should `UnitWork.role = VOLUME` be introduced now, or deferred until the
  generalized book content graph proposal?
- What ranking formula chooses the best release inside a grouped search result
  when multiple releases match inherited work tags equally?
- Should admin diagnostics enforce a hard warning threshold at 200 releases per
  work, or treat 200 as a planning estimate only?
