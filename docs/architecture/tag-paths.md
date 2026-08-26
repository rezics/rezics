# Tag Path architecture

Status: accepted and implemented.

## Domain boundary

A Tag Path is an immutable ordered definition of two to sixteen Tags, from a
broader meaning to a narrower meaning:

```text
人物特征 → 发色 → 红色
```

The terminal Tag and every Path ending at it have different identities. `红色`
is a Tag; `发色 → 红色` is one hierarchy location for that Tag. A Path is
therefore a dedicated Tag-domain Unit with its own UUID, definition votes,
applications, judgments, provenance, and Realm adoption.

This follows MeSH's separation of one concept from its hierarchy locations and
SKOS polyhierarchy:

- [MeSH tree structures](https://www.nlm.nih.gov/mesh/intro_trees.html)
- [SKOS reference](https://www.w3.org/TR/skos-reference/)

Tag Path is not a generic ordered Structure abstraction. Collections are
mutable flat orderings; `content_structure` owns mutable Book, Media, and Realm
navigation trees; Tag Path is an immutable semantic chain. Sharing order does
not give these objects a useful shared lifecycle.

## Identity and immutability

`tag_path.id` references a `unit.kind = tag_path` Unit. The exact
`member_tag_ids` array is the definition identity:

```text
tag_path
  id
  member_tag_ids uuid[2..16]
  terminal_tag_id
  created_by_profile_id
  created_at
```

The database enforces:

- two to sixteen distinct member UUIDs;
- `terminal_tag_id` equal to the final array member;
- exact-array uniqueness;
- active, approved, public Tag members;
- an immutable header and immutable database-maintained projections; and
- no application to a member of the same Path.

The bounded array provides collision-free identity comparison. It is not a
searchable set. Member, inverse, and adjacency access uses
`tag_path_member(path_id, ordinal)`,
`tag_path_member(tag_id, path_id, ordinal)`, and `tag_path_edge`. This follows
PostgreSQL's guidance that searchable elements are normally represented as
rows rather than repeatedly searching an array:
[Arrays](https://www.postgresql.org/docs/current/arrays.html#ARRAYS-SEARCHING).

Definitions cannot be updated or deleted. A changed chain is a new Path Unit,
and contributors cast new judgments against it. There is no definition
version, projection version, correction bypass, correction worker, or
administrative in-place edit.

## Definition governance and manual convergence

`tag_path_vote` records independent `-1 | 1` judgments about a definition.
`tag_path_vote_stat` stores the distribution-preserving aggregate and the
accepted active application count used by provisional display ordering.

Exact duplicate arrays are rejected. Prefixes, suffixes, and extensions are
not automatically duplicates. Curation may warn about them, but only a manual
governance proposal can converge two Path Units.

`tag_path_merge` records source, target, reason, proposer, resolution,
resolver, and timestamps. Acceptance makes the source unavailable for new
applications and ordinary discovery. Resolution follows an indexed,
cycle-free, bounded chain to the target and returns merge provenance.

The source and target UUIDs remain distinct. Definition votes, applications,
and application judgments remain facts about the Path on which they were
created; they are never copied, summed, or reinterpreted as target votes.
Reversal is another audited governance decision, not a definition edit.
Assistance may produce a typed candidate for the same queue or the ordinary
alias workflow, but it has no acceptance authority.

## No primary Path

There is no `tag_primary_path`, `is_primary`, designated-primary vote, manual
selector, or persisted Tag-to-Path projection.

When one breadcrumb must be shown, eligible Paths are ordered dynamically.
The current provisional weight is accepted active Unit–Path usage count in the
applicable authority. Higher usage ranks first; UUID is the deterministic
tie-breaker. Global and Realm usage remain separate.

Usage is not the final relevance formula and proves neither confidence,
specificity, recency, nor Realm relevance. The exported ranking boundary owns
an explicit TSDoc `@todo` to replace it after a separate formula decision.
Callers must not persist the result or describe it as canonical or primary.

## Applications, judgments, and effective Tags

The global application relation is `unit_tag_path(unit_id, path_id)`. Sparse
`unit_tag_path_judgment` rows independently store:

- `fit_vote: -1 | 1 | null`; and
- `spoiler_level: 0 | 1 | 2 | null`.

Each dimension has its own timestamp and at least one dimension must be
present. The aggregate retains score, vote count, and the full spoiler
distribution. Positive fit creates one `unit_tag_path_support` row per Path
member and contributor. Triggers incrementally maintain effective Tag facts,
effective contributor judgments, fit aggregates, and spoiler aggregates.
Deleting an application deletes its now-contextless judgments and derived
support in the same transaction.

Direct Tag judgments and Path-derived support retain distinct provenance. A
negative direct judgment conflicts with positive Path support by the same
Profile and is rejected at the database boundary. Content-label Tags are
handled by the content-label registry and are rejected by semantic Tag
judgment tables.

All write fan-out is bounded by `L <= 16`; request reads use equality or
keyset access and bounded pages. Aggregate mutation uses deterministic
advisory-lock ordering and admission backpressure. See
[Tag Path capacity](./tag-path-capacity.md).

## Search and ordinary Tag input

Ordinary users search Tags, never Paths. A suggestion contains the localized
Tag title, an eligible breadcrumb when useful, and usage evidence. Path search
exists only on curation surfaces.

The single Tag picker behaves as follows:

- no accepted ending Path: save a direct Tag if it is directly applicable;
- one accepted ending Path: apply it silently;
- several accepted ending Paths: show a sense chooser ordered by transient
  weight; and
- category-only Tags reject direct application while remaining valid Path
  members.

Ancestor titles and every word-order permutation are not copied into all
descendant search documents. Compound recovery is bounded:

1. run normal indexed Tag title and alias search;
2. when direct recall is insufficient, enumerate bounded CJK or spaced-token
   splits;
3. resolve at most four Tag identities per side through title and governed
   alias matches;
4. submit at most 32 candidate pairs in one relational query;
5. verify the real broader-before-terminal Path order; and
6. rank semantic query order above reversed order, then use provisional Path
   weight.

This supports `发色红色`, lower-confidence `红色发色`, and `红色头发` when
`头发` is an accepted alias of `发色`, without turning ancestor text into
unconditional descendant synonyms.

## Reading and contribution surfaces

Work pages show a grouped Tag summary and an exact hidden count. Full
exploration shows complete Paths, direct parents and children, fit controls,
the spoiler distribution, and provenance. Path creation is a curation
surface, and immutable definitions require two to sixteen distinct Tags.

Entity pages use a bounded Portable Text preview and expose measurements as
read-only facts. Contribution surfaces provide independent fit and spoiler
judgments, including post-add spoiler judgment. Subject-association spoiler
judgments conceal associated Entity information until reveal.

Author content-spoiler labels and NSFW labels are stored through the
content-label registry. Viewer preferences independently control always-show
spoilers and always-show NSFW. List, feed, detail, snippet, embed,
notification, and SEO projections must suppress concealed content at their
data boundary; an item-level reveal never changes the account preference.

## Realm authority

Realm facts are independent from global facts:

```text
realm_tag_path
realm_tag_path_vote
realm_tag_path_vote_stat
realm_unit_tag_path
realm_unit_tag_path_judgment
realm_unit_tag_path_judgment_stat
realm_unit_tag_path_support
realm_unit_effective_tag
```

A Realm may adopt a globally accepted definition, cast Realm definition
votes, apply the Path to a mounted Unit, and judge fit and spoiler. Fit and
spoiler each have an independent `inherit | isolate` fallback, defaulting to
`inherit`. Resolution returns the chosen authority, resolution state, and
provenance for each dimension.

Profile Realm subscriptions compose display sources only. They never merge
Realm and global vote counts. Realm usage weights rank Realm breadcrumbs and
global usage weights rank global breadcrumbs.

## Measurement and import evidence

`entity_measurement` is an editable fact with an optional context Unit and
`UNIQUE NULLS NOT DISTINCT (entity_id, context_unit_id)`. This guarantees one
canonical row per Entity while allowing contextual rows. Source URL,
observation time, source key, and provenance live in immutable
`content_pack_entity_measurement_evidence`, which references the fact and its
import. Human editing therefore does not require importer evidence.

Definition, application, Tag, subject-association, and measurement import
evidence follows the same rule: evidence is retained separately from editable
or governable facts and can be retargeted only by the bounded Unit-merge
workflow.

## API and ownership map

Public names use Tag Path throughout:

```text
/tag-paths
/tag-paths/:pathId
/units/:type/:unitId/tag-paths/:pathId
/realms/:realmId/tag-paths
/realms/:realmId/units/:unitId/tag-paths/:pathId
```

The backend owner is `services/main/src/services/tag-paths`; the schema owner
is `services/main/src/services/database/schema/tag-path.ts`; advanced
PostgreSQL ownership is split among `tag-path.sql`,
`tag-judgment-aggregates.sql`, `realm-tag-authority.sql`,
`content-label-policy.sql`, `entity-measurement-evidence.sql`, and
`tag-path-search.sql`.

There are no old routes, response aliases, dual writes, compatibility views,
or generic Structure Unit lifecycle branches. Unrelated `content_structure`
contracts retain their existing names.

## Breaking migration

Released history remains append-only. The
`tag_path_entity_semantics` migration first performs bounded `EXISTS` checks
and fails if any rejected Structure or legacy Tag-vote fact exists. It then
rebuilds the persisted Unit-merge phase enum without retired Structure labels,
drops rejected tables and functions, removes `unit.kind = structure`, creates
the final relations and guards, and installs the canonical PostgreSQL owners.
It performs no backfill and makes old binaries fail against the new contract.
