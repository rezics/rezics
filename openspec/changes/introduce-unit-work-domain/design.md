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

Hidden grouping / inherited search / shared community/content:
  Work Unit through UnitWork membership
```

This means users normally open and interact with release Units. The hidden work
Unit behaves like an aggregation domain, but it is not a normal user-facing book
detail page. Work-level tags, aliases, community feeds, shelves, posts,
reviews, and other work-domain content are resolved through the `UnitWork`
relation.

The repo already has adjacent patterns:

- `UnitTag` attaches classification to a Unit.
- `RealmUnit` attaches a Unit to a realm feed/community, but its name is
  inconsistent with the `UnitX` relationship pattern.
- Search sync already denormalizes translations, aliases, tags, realms, and
  shelf membership into Meilisearch documents.
- The job-runner already owns CDC/outbox-backed search synchronization.

## Goals / Non-Goals

**Goals:**

- Introduce `UnitWork` as the canonical relationship between any
  work-domain-participating Unit and hidden work Units.
- Keep release Units first-class for pages, reading, shelves, reviews, posts,
  attribution, and content.
- Let release search inherit work-level tags and work-level searchable text
  without maintaining duplicate tags on every release.
- Make Meilisearch queries fast by denormalizing inherited work fields into
  release documents at indexing time.
- Group release search results by work so ordinary searches do not show every
  publisher/edition/translation as a top-level duplicate.
- Keep book language switching scoped to the current release's
  `UnitTranslation` rows, and move same-work release discovery into the
  Releases tab.
- Register posts, reviews, shelves, and other work-domain content in
  `UnitWork` so any same-work release can query shared content.
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
unitId             member Unit participating in a work domain
workUnitId         hidden work Unit
role               RELEASE | POST | REVIEW | SHELF | WIKI | GUIDE | DERIVED
language           optional content language hint
position           optional work-local fractional index
displayPolicy      PRIMARY | SECONDARY | HIDDEN_BY_DEFAULT
createdAt
updatedAt
```

`UnitWork` is canonical. `Unit.workUnitId` may remain during migration as a
denormalized shortcut, but new behavior must read the relationship semantics
from `UnitWork`.

`UnitWork` is Unit-based, like `UnitTag` and `UnitRealm`. It is not a
release-only work link and it is not a shelf/post-specific projection table.
Releases, posts, reviews, shelves, wiki pages, guides, and future content types
can all enter a work domain by creating `UnitWork` rows. Release membership is
special only by invariant: a visible release belongs to at most one canonical
work in v1. Content Units such as posts and shelves may belong to multiple work
domains when their precise targets or contained Units cross works.

Alternatives considered:

- **Keep only `Unit.workUnitId`**: too weak for multi-role work-domain
  membership, content aggregation, position, display policy, and future
  migration. It also hides the relationship behind a generic column name that
  call sites misuse.
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
├─ work-domain content/community feed by default
├─ exact-release filter
├─ release-local language switcher
└─ Releases tab for same-work release discovery
```

Work Units may have admin/editor surfaces, but they are not the ordinary public
book detail destination.

### Keep Language Switching Release-Local

The book detail language switcher keeps its original semantic scope: it switches
among `UnitTranslation` records on the current visible release. It does not
select another release in the work domain and it does not use a work-language
default table.

When the current release lacks the viewer's desired language, the UI shows a
missing-language option such as "not found in your language". Activating that
option navigates to the Releases tab. The Releases tab lists same-work releases
through `UnitWork(role = RELEASE)`, supports multi-select language filtering,
defaults the filter to the viewer's preferred languages, provides an All option,
and orders results by `UnitWork.position` fractional indexing.

`UnitTranslation.sourceReleaseUnitId` is renamed to `sourceUnitId` and no longer
owns release selection. Release selection is an explicit Releases tab action.

### Store Precise Targets, Aggregate Through `UnitWork`

Posts, reviews, shelves, and other content need both precise target context and
work-domain membership:

```txt
targetUnitId      exact release/work/post target, when the content has one
UnitWork          work-domain membership rows for aggregation, if applicable
```

Default release pages show work-domain content by querying `UnitWork` rows for
the current release's canonical work. Exact-release filters remain available by
filtering `targetUnitId = currentReleaseId`.

Normal content writes are cheap and synchronous:

```txt
create post targeting release-a
├─ read UnitWork(release-a, role = RELEASE) -> work-x
├─ create Post(targetUnitId = release-a)
└─ create UnitWork(postUnitId, work-x, role = POST)
```

When release-b belongs to work-x, release-b does not query release-a. It queries
work-x's content membership and receives posts, shelves, reviews, and other
Units registered under the same work domain. Cards in work-domain feeds still
render precise target context. If a feed item targets a release different from
the current release, the card shows that target release's identifying metadata,
matching search and shelf rendering semantics.

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
position
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
- `UnitWork` inserted/updated/deleted: rebuild the affected Unit's search
  document and relevant grouped search metadata.
- Work alias/translation/searchable metadata changed: rebuild release documents
  inheriting those work fields.
- Release move or work merge/split/admin repair: enqueue a bounded batch repair
  job that recalculates affected work-domain memberships and projections.

Batch handlers should process work members in pages and be idempotent. The
initial target limit is 200 release members per work. Total work-domain
membership can be much larger because posts, shelves, reviews, and other content
also register in `UnitWork`. Public APIs must page by role/type and cursor, and
diagnostics should flag unusually large work domains or repair scopes.

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
- **Risk: release-only assumptions remain in work-domain code** →
  Mitigation: make `UnitWork` role semantics explicit and test release,
  post/review, shelf, and multi-work content membership separately.
- **Risk: `RealmUnit` rename makes the change noisy** → Mitigation: keep it in
  its own task phase and avoid changing realm behavior beyond naming.
- **Risk: users cannot find another language release from the language
  switcher** → Mitigation: keep the switcher release-local but add a
  missing-language option that jumps to the Releases tab with preferred
  languages preselected.
- **Risk: Work-level tags over-apply to release-specific searches** →
  Mitigation: store `ownTagIds`, `workTagIds`, and `allTagIds` separately so UI
  and ranking can distinguish inherited vs release-local matches.
- **Risk: release move or work merge corrupts historical work-domain
  membership** → Mitigation: make these operations admin-only, previewable,
  durable, async, resumable, and backed by repair jobs that recalculate
  `UnitWork` memberships for affected posts, reviews, shelves, and search
  projections.

## Review Addendum: Creation, USWN, Merge, And Content Structure Decisions

The review tightened several product decisions that are broader than the
initial read/search design.

### USWN Is Derived Library Metadata, Not Stored Identity

Library content DTOs expose:

```txt
metadata.uswn: string | null
```

USWN means Universal Standard Work Number. It is a frontend/library metadata
standard, not a new backend primary key, table, or stored column. In this
change, `metadata.uswn` is derived from the merge-resolved canonical work Unit
id:

```txt
release with work domain  -> metadata.uswn = canonical work Unit.id
no work domain            -> metadata.uswn = null
source work merged        -> metadata.uswn = target work Unit.id
```

The frontend renders the server-provided field and does not resolve work merges
client-side.

### Ordinary Creation Is Release-Led

Ordinary public/personal content creation does not expose standalone hidden work
creation. Creating a book means creating a visible release and attaching it to a
work domain. The first release/original version may create a hidden work domain
as part of the release-led flow, but hidden work creation by itself is reserved
for admin repair and maintenance.

Public creation should strongly prompt users to search for an existing work
before creating a new release. Personal creation should use quieter guidance,
for example a help affordance on the work row. The guidance should specifically
call out translations, language versions, reprints, and platform/source variants
as cases that should attach to an existing work.

Work matching uses ordinary content search. Users search books/releases, not
hidden works. Selecting a release that already belongs to a work binds the new
release to that release's canonical work. Selecting a standalone release may
create a hidden work domain containing both the matched release and the new
release.

### Hidden Work Labels Come From Release Context

Hidden work Units should not require ordinary users to author a separate public
work title. Public UI labels a work context from the primary release, release
list context, aliases, or admin-only maintenance metadata. This keeps the work
domain as infrastructure for grouping and avoids making it compete with visible
releases as a catalog object.

### Admin Work Merge Is Canonical Migration Plus Optional Metadata Copy

Admin work merge is a repair operation:

```txt
source work W_old -> target work W_new
```

Merge migrates canonical release/content membership and projections to the
target work. It does not delete the source work Unit. It also does not
destructively merge all source-work metadata. Source work tags, aliases,
external references, attribution, history, and similar non-membership evidence
remain on the source work by default to preserve auditability and rollback
options.

For active works, merge is async and durable. It needs dry-run preview,
item-level progress, resumability, and enough before-state to revert. The merge
operation enqueues repair for content search, post search, shelf work-domain
membership, general work-domain membership, and DTO metadata such as USWN.

Metadata copy is separate from canonical merge. Admins may explicitly copy
missing tags or aliases from source work to target work. Copy creates only rows
that the target does not already have, leaves source rows unchanged, and can be
run or reverted independently from content membership migration.

### Content Structure Uses contentUnitId

The change should stop expanding book/chapter-specific terminology into new
public contracts. The generic concept is `contentStructure`; a materialized node
identity is `contentUnitId`. For books, `contentUnitId` is the materialized
chapter content Unit. `targetUnitId` remains interaction terminology for posts,
reviews, ratings, and discussion targets.

## Review Addendum: Unit-Based Work Domain And Release UX

Later discussion clarified that `UnitWork` is the work-domain membership index
for all content, not just the release-to-work link.

```txt
UnitTag   = Unit belongs to tag/classification
UnitRealm = Unit belongs to realm/feed
UnitWork  = Unit belongs to work domain
```

This means every work-domain surface queries `UnitWork(workUnitId = currentWork)`
by role/type. A release page for `release-b` does not inspect `release-a`
directly; it resolves `release-b` to `work-x`, then queries all content Units
registered under `work-x`. Precise target fields still matter for rendering.
When a work-domain card targets `release-a` while the current page is
`release-b`, the card renders `release-a` metadata so users can tell which
release the item actually discusses.

Release membership is constrained: a visible release normally belongs to one
canonical work in v1. Other content can belong to multiple works. A post
published under two cross-work release contexts, or a shelf that contains
releases from multiple works, creates multiple `UnitWork` rows for the same
content Unit.

Normal content writes register work-domain membership at write time and do not
require broad fan-out. The expensive and dangerous paths are release move and
work merge, because they can invalidate historical content memberships. Those
operations must be admin-only and repair-backed.

The language switcher remains release-local. It switches the current release's
`UnitTranslation` rows and does not navigate to another release. Missing
language discovery lives in the Releases tab. That tab supports multi-select
language filtering, defaults to the viewer's preferred languages, includes an
All option, and orders same-work releases by `UnitWork.position` fractional
indexing.

## Migration Plan

1. Add contract types and Prisma model for `UnitWork`.
2. Backfill `UnitWork` from existing `Unit.workUnitId`.
3. Add consistency checks that detect drift between `Unit.workUnitId` and
   `UnitWork`.
4. Rename `RealmUnit` code/schema/API names to `UnitRealm` in a focused phase.
5. Rename `UnitTranslation.sourceReleaseUnitId` to `sourceUnitId`.
6. Add `UnitWork` membership writes to post/review/shelf creation and update
   paths where content enters or leaves a work domain.
7. Extend search document contracts and Meilisearch filterable attributes.
8. Implement inherited work tag/search projection and grouped result assembly.
9. Add job-runner handlers for work-tag fan-out, `UnitWork` changes, release
   move, work merge, and repair/backfill jobs.
10. Update book language switcher to remain release-local and add the
    missing-language Releases tab affordance.
11. Update the Releases tab and shelf rendering to use `UnitWork.position` and
    precise target release context.
12. Rebuild Meilisearch indexes and run drift repair diagnostics.

Rollback strategy:

- Keep `Unit.workUnitId` populated during the first implementation phase.
- Search can fall back to non-inherited release documents if inherited work
  fields are disabled.
- UI can fall back to current release selector behavior if the Releases tab is
  incomplete.
- The `RealmUnit` rename is not independently rollback-friendly after migration;
  schedule that phase only after the `UnitWork` design is accepted.

## Open Questions

- Should hidden work Units have a dedicated status/visibility flag, or is
  visibility controlled only by route/search policy?
- Should `UnitWork.role = VOLUME` be introduced now, or deferred until the
  generalized book content graph proposal?
- What scoring formula chooses the best release inside a grouped search result
  when multiple releases match inherited work tags equally after
  `UnitWork.position` and display policy are considered?
- Should admin diagnostics enforce a hard warning threshold at 200 releases per
  work, or treat 200 as a planning estimate only?
