# VNDB v11 Entity, Tag Path, Spoiler, and Measurement Research Report

Status: temporary completion ledger; implementation complete, deterministic
validation pending. The permanent architecture has been reconciled. Delete
this report after the final validation-and-fix commit.
Date: 2026-08-26

## Scope and authority

This report defines one continuous implementation chain with no Phase 0–4
approval pauses and no compatibility period for the rejected preview model.
Completion covers database, backend, API, generated clients, frontend,
localization, content-pack import, Realm authority, operations, and permanent
documentation.

[tag-paths.md](./tag-paths.md) is now the permanent dedicated-domain
architecture, and [tag-path-capacity.md](./tag-path-capacity.md) owns the
vendor-neutral 500-million/3-billion-row capacity contract. The accepted
spoiler, content-label, Realm, and measurement semantics in
[entity-tag-spoiler-and-measurement-decisions.md](./entity-tag-spoiler-and-measurement-decisions.md)
have been reconciled to the final physical names and remain authoritative.

`content_structure` is unrelated. It owns Book and Media outlines and is not
renamed or removed.

## Content-pack state

The external showcase source adapter remains `vndb-v11` and its implemented
manifest version is `0.2.0`. It emits dedicated `tagPaths` and
`tagPathApplications`, structured Entity measurements, and immutable source
evidence. The repository loader contract asserts that version whenever the
showcase pack source is available. VNDB-specific names remain confined to that
source adapter, its source-lock test, and this temporary report.

## Corrected domain model

### Tag Path is a dedicated Unit

A Tag Path is an immutable ordered definition of two to sixteen Tags from a
broader meaning to a narrower meaning:

```text
发色 → 红色
人物特征 → 发色 → 红色
```

The terminal `红色` Tag and each Path ending at it have different identities.
A Path therefore has its own UUID, ownership, definition judgments,
application judgments, source provenance, and history. This follows MeSH's
separation of one concept from its hierarchy locations and SKOS polyhierarchy.

Path is a Tag-domain Unit, not a generic ordered Structure Unit:

```text
unit.kind = tag_path
tag_path.id → unit.id
tag_path_member.path_id → tag_path.id
tag_path_member.tag_id → tag.id
```

`services/main/src/services/database/schema/tag-path.ts` replaces and deletes
`services/main/src/services/database/schema/structure.ts`. TypeScript uses
`TagPath*`, SQL uses `tag_path*`, and public APIs use `pathId` and
`/tag-paths`. Remove `unit.kind = structure`, `UnitStructureKindValues`,
`UnitStructureKind`, `tag.hierarchy_path`, generic `unit_structure*` owners,
and every Structure Unit route, filter, search, feed, following, SEO, view,
alias, adapter, and dual write.

Being a Unit supplies identity and lifecycle, not automatic access to every
generic Unit capability. Collections are mutable flat orderings,
`content_structure` is a mutable owned tree, and Tag Path is an immutable
semantic chain. Their shared ordering does not justify one abstraction.

### Definition identity

`tag_path` stores:

```text
id
member_tag_ids       uuid[2..16]
terminal_tag_id
created_by_profile_id
created_at
```

The database enforces exact-array uniqueness, distinct members, two to sixteen
members, `terminal_tag_id` equal to the final member, and active, approved,
public Tag membership. The definition array and terminal Tag cannot be edited.
A changed definition is a new Path Unit; there is no `definition_version`,
projection version, correction bypass, or in-place administrative edit.

The array is for bounded identity comparison, not member search. Membership,
reverse lookup, adjacency, and traversal use `tag_path_member` and rebuildable
projections. PostgreSQL cautions that searchable elements should normally be
rows rather than an array treated as a set:
[Arrays](https://www.postgresql.org/docs/current/arrays.html#ARRAYS-SEARCHING).

### Full paths, breadcrumbs, and manual governance merge

Path identity and presentation are separate:

- store every semantically meaningful hierarchy member;
- exclude nodes that exist only as visual section headings;
- ordinary suggestions may render the shortest suffix that disambiguates the
  terminal Tag; and
- exploration and provenance expose the complete Path.

If `人物特征 → 发色` is a real broader-to-narrower assertion, the stored Path
may be `人物特征 → 发色 → 红色` while a compact breadcrumb renders
`发色 → 红色`. The abbreviation does not create another Path.

Exact duplicates are rejected. Prefix, suffix, and extension relationships are
not automatically duplicates and never trigger an automatic merge. They emit
a curation warning.

Consolidation is an explicit manual governance operation. A proposal names a
source Path, a target Path, a typed reason, proposer, and provenance. It passes
the ordinary governance authority; assisted systems may propose but cannot
accept. Once accepted:

1. source and target remain immutable Units with distinct UUIDs;
2. the source is unavailable for new applications and ordinary discovery;
3. resolution returns the target together with merge provenance;
4. source definition votes and application judgments remain source facts and
   are not copied, summed, or reinterpreted as target votes;
5. a target application judgment is new evidence, not a migrated vote;
6. self-targets and cycles are rejected, and chains resolve with bounded
   indexed work; and
7. a later reversal is another auditable governance resolution, never an
   in-place definition edit.

This is manual domain governance, not automatic prefix normalization and not a
compatibility alias.

### No primary selection

There is no `tag_primary_path`, `is_primary`, designated-primary vote, manual
primary selector, or persisted `Tag → primary Path` projection.

When a read needs one breadcrumb among several accepted Paths ending at a Tag,
it computes the highest-ranked eligible Path. That result is transient display
ordering, not canonical identity or governance state. Search relevance still
ranks title and alias matches first; Path weight chooses a breadcrumb and
orders otherwise equivalent Path contexts.

The provisional weight is the accepted active Unit–Path usage count in the
applicable authority. Higher count ranks first; equal counts use Path UUID only
for deterministic ordering. Global and Realm counts stay separate.

Usage count is not the final formula: it does not prove confidence,
specificity, recency, or Realm relevance. Callers must not persist the result,
expose it as primary, or treat it as authority. The owning exported TypeScript
ranking boundary must include:

```ts
/**
 * Ranks accepted Tag Paths for transient search and display ordering.
 *
 * @remarks
 * The current weight is accepted active usage count only. The result is not a
 * canonical or manually selected primary Path and must not be persisted as one.
 *
 * @todo Replace the provisional usage-count-only weight with the separately
 * adopted final ranking formula.
 */
```

The TODO is a required honesty boundary, not permission to invent an
undocumented formula.

## Search and ordinary Tag input

Ordinary users search Tags, not Paths. Suggestions contain the localized Tag
title, a dynamically ranked breadcrumb when useful, and usage evidence. Path
search remains restricted to curation surfaces.

Do not copy ancestor titles, word-order permutations, or every alias into each
descendant search document. Resolve compounds as follows:

1. normalize and run direct Tag title/alias search;
2. when direct results are insufficient, enumerate bounded two-part CJK or
   spaced-token splits;
3. resolve each side to a bounded set of Tag IDs through exact title, accepted
   alias, and prefix matches;
4. batch candidate pairs into one indexed query over accepted `tag_path` and
   `tag_path_member` rows;
5. validate the real broader-before-terminal Path order even if query words are
   reversed; and
6. rank exact title above alias, semantic query order above reversed order,
   then apply the provisional Path weight.

```text
发色红色   → 发色 | 红色 → 发色 → 红色
红色发色   → 红色 | 发色 → 发色 → 红色, with lower order score
红色头发   → 红色 | 头发 → 发色 → 红色, if 头发 aliases 发色
```

Initial bounds are: fewer than three direct hits; at most 16 unspaced CJK
characters and 15 cuts; at most six spaced tokens; four Tag candidates per
side; 32 candidate-pair probes; and five decomposed suggestions. These are
logical probes, not database round trips. Candidate pairs are submitted in a
batch. Governed aliases resolve to Tag identities rather than becoming
unconditional global synonyms, although PGroonga provides the underlying
indexed expansion primitives:
[PGroonga query expansion](https://pgroonga.github.io/reference/functions/pgroonga-query-expand.html).

Required access paths include:

```text
tag_path_member(path_id, ordinal)
tag_path_member(tag_id, path_id) INCLUDE (ordinal)
tag_path(terminal_tag_id, id)
```

Search never scans Unit–Path application facts; ranking reads a bounded
aggregate by Path and authority. The one ordinary Tag picker behaves as follows:

- no accepted ending Path: save a direct Tag;
- one accepted ending Path: apply it silently;
- several: show a sense chooser ordered by computed weight, with no primary
  marker or manual primary selection; and
- `directly_applicable = false`: reject direct application while allowing
  governed hierarchy context.

## Final physical model

| Rejected preview object | Final object |
| --- | --- |
| `unit_structure` | `tag_path` |
| `unit_structure_member` | `tag_path_member` |
| `unit_structure_edge` | `tag_path_edge` or rebuildable adjacency |
| `unit_structure_end` | removed; use `tag_path.terminal_tag_id` |
| `unit_structure_vote` | `tag_path_vote` |
| `unit_structure_vote_stat` | `tag_path_vote_stat` |
| primary candidate/projection tables | removed with no replacement |
| `unit_structure_application` | `unit_tag_path` |
| application judgment/stat | `unit_tag_path_judgment` / `_stat` |
| `unit_tag_structure_support` | `unit_tag_path_support` |
| correction/version machinery | removed |
| `realm_structure` / `_vote` | `realm_tag_path` / `_vote` |
| Realm Structure application | `realm_unit_tag_path` judgment/stat/support |

Manual merge governance uses dedicated facts and a bounded active resolution
projection; it does not restore mutable correction machinery.

Corpus-scale relations choose partition-routing keys from their first release:
Path facts by `path_id`, global application facts by `unit_id`, Realm facts by
`(realm_id, unit_id)`, and hierarchy reads by `tag_id`. PostgreSQL declarative
partitioning can route these keys without whole-corpus scans:
[Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).

## Measurement facts and evidence

`entity_measurement` stores editable facts keyed by `(entity_id,
context_unit_id)` with `UNIQUE NULLS NOT DISTINCT`. Import URL, observation
time, source key, and provenance belong to
`content_pack_entity_measurement_evidence`, which references the measurement
and import. Human edits therefore do not require importer evidence. PostgreSQL
supports the required nullable-key uniqueness directly:
[Unique constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS).

## Destructive append-only migration

Released migration history remains append-only. A new vendor-neutral breaking
migration such as `tag_path_entity_semantics` must:

1. assert that every preview Structure/Path table is empty and fail otherwise;
2. drop rejected tables, functions, triggers, views, and `structure` Unit kind;
3. create final Tag Path, judgment, merge, Realm, content-label, measurement,
   and evidence relations;
4. perform no conversion or backfill;
5. provide no compatibility view, alias, adapter, or dual write; and
6. make old binaries fail instead of operating against changed semantics.

`VNDB` remains only in the source pack adapter and this temporary report, never
in migrations, SQL owners, runtime files, tasks, or contract checkers.

## Capacity evidence

Record workload and storage evidence at 500,000,000 rows and estimate
3,000,000,000 rows for every corpus-scale Path, member, vote, application,
support, merge-resolution, aggregate, and Realm relation. Cover distribution,
read/write rates, Path length (`L ≤ 16`, expected two to four), hot-key skew,
latency and throughput, row/index storage, WAL/network cost, write
amplification, freshness, backpressure, partition pruning, maintenance,
cutover, and the sharding or archival path past one-node limits.

Risky queries require representative distributions and `EXPLAIN` or `EXPLAIN
ANALYZE`. Compound search must prove bounded candidate work, indexed joins, and
no corpus scan; toy fixtures alone are not acceptance evidence.

## Completion ledger

| Area | Implemented contract | State before final validation |
| --- | --- | --- |
| Preview removal | unpublished vendor migration/tooling, correction/version machinery, generic Structure Unit branches, routes, filters, feed/follow/SEO, aliases, and dual-write assumptions removed; `content_structure` preserved | complete |
| Database | immutable `tag_path` Unit, projections, judgments, distribution-preserving aggregates, effective provenance, subject spoilers, labels, measurements/evidence, manual merge governance, Realm authority, preferences, bounded indexes, and vendor-neutral breaking migration | complete |
| Governance | manual merge queue and decision latency; human/assisted proposal source is typed and immutable; assisted candidates have no review or acceptance authority | complete |
| API/backend | dedicated creation/read/vote/application/exploration/merge, Realm, spoiler, measurement, label, preference, and curation-search contracts; no primary field or old route | complete |
| Search/input | ordinary Tag-only suggestions, bounded CJK/spaced decomposition, title/alias resolution, semantic/reversed-order ranking, curation-only Path search, and provisional accepted-usage weighting with the required exported `@todo` | complete |
| Reading/contribution | grouped summaries, exact remaining counts, Entity description collapse, measurements, fit/spoiler grids, subject concealment, authored content-spoiler and NSFW preference behavior | complete |
| Realm | `inherit \| isolate`, separate definition/application aggregates and weights, independent fit/spoiler fallback, explicit authority/resolution/provenance, subscription composition without vote merging | complete |
| Frontend/i18n | `TagPath*` and `/tag-paths` replacement, typed termbase usage, natural copy in every supported locale, generated API consumers updated | complete |
| Permanent docs/capacity | dedicated architecture and vendor-neutral capacity documents plus reconciled spoiler/measurement decisions | complete |
| Deterministic validation | migration hash/replay, PostgreSQL owner checks, OpenAPI drift, TypeScript, i18n, tests, representative `EXPLAIN` and capacity evidence | pending final validation commit |

## Completion checks

Run the affected frontend TypeScript check, schema generation and full
migration replay, OpenAPI and both generated-client drift checks, localization
policy checks, and representative `EXPLAIN` evidence once at the end. These are
deterministic contract checks, not browser or visual acceptance. Delete this
temporary report only after all failures are repaired and committed.

## Deferred beyond this contract

The final Path ranking formula beyond provisional accepted usage count,
measurement ranges and uncertainty, Realm subject-association spoiler,
credit/series content labels, progress-aware reveal, multi-target spoiler, and
image-asset screening require separate architecture decisions. The ranking
TSDoc TODO is the explicit boundary for the first item.
