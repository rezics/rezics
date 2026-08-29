# Tag Path semantic architecture

Status: accepted and implemented.

## Domain boundary

REZICS separates vocabulary structure, Unit assertions, retrieval inference,
and presentation:

```text
Vocabulary node + typed relation -> Tag Path
Tag Path + Expression binding     -> Path Sense
Unit + authority + Path Sense     -> Path Application
accepted source Applications      -> Expression assertion
Expression assertion + rules      -> Effective Tags
visible source Applications       -> contextual rendered badge
```

The central invariant is:

```text
Path != Expression != Application != Effective Tag != rendered badge
```

A Tag is a stable concept identity. A Path is only an immutable route through
the vocabulary graph. A Tag Expression is the proposition that can be asserted
about a Unit. A Path Sense binds Path members to that Expression. An
Application records that a Unit adopts one immutable Sense under one authority.
Effective Tags are rebuildable retrieval evidence, and rendered labels are
temporary UI projections.

Consequently, `Character Traits -> Appearance -> Hair Color -> Red` can realize
the Expression `facetValue(Hair Color, Red)`. The Overview label is
`Hair Color · Red`; the complete Path remains available as source explanation
and navigation. Path membership never asserts every member about the Unit.

This follows the established distinction between concept identity, hierarchy
position, indexing statement, and retrieval expansion in
[MeSH](https://www.nlm.nih.gov/mesh/intro_trees.html) and
[SKOS](https://www.w3.org/TR/skos-reference/).

## Vocabulary structure

`vocabulary_node` unifies two graph-node kinds:

- `concept`: has a corresponding `tag`, may be an Expression argument, and may
  participate in retrieval;
- `guide`: has localized guide-node labels and is organizational only. It is
  neither a Unit nor an assertable/indexable Tag.

`tag_relation` is a governed adjacency revision with one of these meanings:

- `generic`;
- `partitive`;
- `instance`;
- `organizational`;
- `facet_value`.

Active relations form a directed acyclic graph. PostgreSQL serializes relation
graph changes with a transaction advisory lock and rejects self-edges and
cycles. Parent and child composite indexes serve bounded hierarchy reads.
Relations referenced by a Path cannot be retired, deleted, or semantically
changed; a semantic correction creates another relation revision and Path.

## Structural Path identity

`tag_path` is a dedicated `unit.kind = tag_path` Unit. Its identity is exactly:

```text
ordered member_node_ids + ordered relation_ids
```

The database enforces:

- two to sixteen distinct active vocabulary nodes;
- exactly one active typed relation between each adjacent pair;
- the terminal node equal to the final member;
- a unique structural sequence and SHA-256 structural identity;
- immutable Path definitions; and
- trigger-owned `tag_path_member` and vote-stat projections.

`tag_path_member(path_id, ordinal, node_id, incoming_relation_id)` contains only
structure. It has no support, display, assertion, or inference flags. The
`(node_id, path_id, ordinal)` index supports keyset-paged discovery of every
accepted Path position containing a Tag, not merely terminal positions.

Path definition votes judge structural validity. Accepted usage is maintained
separately from definition score and is used only as replaceable ranking
evidence. There is no semantic `primaryPath` for a concept.

## Tag Expressions

`tag_expression` is an immutable structured proposition with a unique canonical
claim key, kind, and focus Tag. Implemented kinds are:

- `simple`, for `simple(TypeScript)`;
- `facet_value`, for `facetValue(HairColor, Red)`;
- `relation`, for another predicate/focus proposition.

`tag_expression_argument` assigns concepts independently to `predicate`,
`slot`, `value`, `focus`, and `qualifier` roles. Roles are not a single
mutually-exclusive Path-member enum; the same concept may serve more than one
semantic purpose.

Presentation is independently revisioned:

- `tag_expression_presentation_revision` owns a sealed immutable revision;
- `tag_expression_label_component` stores the ordered standalone signature and
  optional collision-repair components;
- `tag_expression_group_key` declares the only component a renderer may use as
  a semantic group heading.

Changing Path structure creates a Path. Changing a proposition creates an
Expression/Sense. Changing a synonymous label signature creates a presentation
revision. Renderer punctuation or abbreviation is policy and creates neither.

Each Tag receives a sealed simple Expression during bootstrap, seed, and
content-pack ingestion. Qualified Expressions remain distinct from that simple
claim. A negative judgment on bare `Red` therefore does not conflict with a
positive Application of `Hair Color = Red`; they have different claim keys and
source identities.

## Inference and retrieval

`tag_expression_inference_rule` is an immutable governed revision from a source
Expression to exactly one target Tag or Expression. Its kind is:

- `entailed`: semantic evidence that may appear as an inferred match;
- `retrieval_only`: recall expansion that is never presented as a direct claim.

Rule retirement preserves history and recomputes the definition-scale closure.
Expression-target rules are cycle-checked under a serialized graph mutation.
`tag_expression_effective_tag` stores the strongest `primary`, `entailed`, or
`retrieval_only` evidence per Expression/Tag pair. It is a rebuildable
definition cache, not a Unit assertion and not a display identity.

When that closure changes for an Expression that is already asserted, the
database upserts `tag_expression_projection_rebuild`. The worker advances
Global and Realm assertion inverses in independent UUID keyset pages of 500,
refreshes only the routed Unit/authority keys, and retries failed pages with a
bounded delay. A newer definition change resets the same job's cursors after
the in-flight transaction releases its row lock, so an older generation cannot
silently win.

No ancestor is inferred merely because it occurs earlier in a Path. An
intermediate concept becomes searchable only through an explicit rule.

## Path Senses and lifecycle

`tag_path_sense` is an immutable mapping from a structural Path to one
Expression under either global or Realm scope. `tag_path_sense_binding` maps a
Path member ordinal to an Expression argument role and ordinal. Sealing checks
that every binding refers to the same concept on both sides.

A Realm may adopt a global Sense without changing it. A genuinely different
Realm interpretation receives a distinct Realm-scoped Sense and identity.

Expressions, presentation revisions, inference rules, and Senses use
append-only lifecycle transitions. Active definitions may be retired; semantic
fields cannot be edited and rows cannot be deleted. Existing Applications keep
resolving their sealed historical definitions. New Applications require an
active sealed Sense, so retirement prevents new adoption without rewriting
history.

## Source Applications and judgments

The source-of-truth facts are:

```text
unit_tag                         -- direct simple-Expression source
unit_tag_path_application       -- global Path-Sense source
realm_unit_tag                  -- Realm direct source
realm_unit_tag_path_application -- Realm Path-Sense source
```

A Path Application points to `sense_id`, never only to `path_id`. Sparse
Application judgments independently record fit and spoiler dimensions and
retain their full distributions. Voting controls target the source
Application, even when multiple sources render as one badge.

Global and Realm source populations, votes, usage, and assertions remain
separate. Authority is part of every Realm key. Realm fallback policies decide
which source population is read; they never merge vote counts or identities.

## Rebuildable projections

PostgreSQL incrementally maintains:

- `unit_expression_assertion` and `realm_unit_expression_assertion`, aggregated
  by Unit, authority, and Expression;
- `unit_effective_tag` and `realm_unit_effective_tag`, with separate direct,
  primary-Expression, entailed, and retrieval-only evidence counts;
- Application judgment aggregates and Path usage ranks; and
- search documents and match-reason projections.

An accepted Application creates one Expression assertion source regardless of
Path length. Effective Tag work is proportional to the Expression's explicit
closure, not to every Path member:

```text
old all-member fan-out O(L) -> explicit output fan-out O(A), normally A = 1
```

Projection functions are idempotent and rebuildable from direct applications,
accepted Path Applications, and definition closure. Trigger-owned projection
tables reject ordinary direct writes. Operators can enqueue and drain every
currently asserted Expression with
`task services-main:tag-expression-projections:rebuild`; the normal worker
drains definition-change jobs continuously with lock-skipping claims.

## Contextual rendering

The frontend renderer receives only Applications already filtered for
authority, permission, spoiler, and content-label visibility. It then:

1. aggregates sources by `(authority, expressionId)` while retaining every
   Application and provenance record;
2. uses only an explicitly declared Expression group key;
3. subtracts context by semantic Tag ID and role, never by matching text;
4. preserves at least one `value` or `focus` component; and
5. repairs collisions by restoring omitted required components, fallback
   components, a Path ancestor, authority/relation context, and finally a full
   breadcrumb.

Different Expressions are never merged because they render the same string.
Rendered labels, residual components, grouping, and shortest unique
breadcrumbs are not persisted.

## Surface behavior

- Unit Overview renders applied Expressions, optionally grouped by declared
  semantic group key. It does not render Effective Tags as source badges.
- A badge popover first lists Applications on that Unit, their authority,
  judgments, and expandable full Paths. A collapsed second section lists other
  accepted vocabulary positions not adopted by the Unit.
- Associations use compact Expression projections rather than bare Entity Tags.
- search results show localized match reasons and distinguish direct, primary,
  entailed, and retrieval-only evidence; Tag results also disclose the count of
  other positions;
- the Tag picker returns explicit direct-Expression or Path-Sense choices and
  never silently chooses an ambiguous terminal Path;
- Tag detail is concept-centered and separates qualified Expressions, every
  structural position, inferred reach, and direct children;
- Path detail shows the complete typed route, guide nodes, structural votes,
  Senses, bindings, inference revisions, provenance, authority, and lifecycle;
- curation creates typed structure, Expressions, Senses, presentation
  signatures, role bindings, and inference rules together.

All visible copy is owned by typed `@rezics/i18n` resources in every supported
locale. App Router entries remain thin adapters; implementation lives under
`apps/web/features/tags`.

## Search access paths

Path position discovery uses UUID keyset pagination over
`tag_path_member(node_id, path_id, ordinal)`, joins accepted Path vote stats,
and hydrates members in one bounded batch. Concept Expression reads are
definition-scale and capped. Unit landscape reads are bounded by actual source
Applications and hydrate definitions in batches.

Search indexing consumes Effective Tags but returns positive match evidence
only. Direct content mode explicitly filters source direct Tags; semantic mode
uses primary, entailed, and retrieval evidence. Match explanations preserve the
evidence kind that caused retrieval.

## Governance, import, and ownership

Path merges govern structural convergence only. Source and target IDs, votes,
Applications, and judgments remain historical facts and are not copied or
summed. Expression and inference governance remain separate from Path merges.

Content packs and seed/bootstrap flows declare guide nodes, typed relations,
Expressions, Senses, Applications, and immutable evidence explicitly. They do
not infer Senses from old member arrays. Merge evidence retargeting remains
bounded and audited.

Primary implementation owners are:

- schema: `services/main/src/services/database/schema/vocabulary.ts`,
  `tag-expression.ts`, and `tag-path.ts`;
- PostgreSQL projection/lifecycle owners: `schema/postgres/tag-path.sql`,
  `tag-judgment-aggregates.sql`, and `realm-tag-authority.sql`;
- backend behavior: `services/main/src/services/tag-expressions` and
  `services/main/src/services/tag-paths`;
- frontend behavior: `apps/web/features/tags`;
- public schemas: `services/main/src/services/api/tags` and generated OpenAPI
  clients.

## Destructive preview cutover

The former Tag Path model was unreleased development-preview data. The cutover
is a new append-only forward migration that destructively removes its Path
edges, all-member support rows, old application/judgment identities, and old
projection columns. It creates the final vocabulary, Expression, Sense,
Application, and projection model without guessing historical semantics.

There are no old routes, schema aliases, dual reads, dual writes, compatibility
views, display fallbacks, or removal guards. Old binaries are deliberately
incompatible. Blank-database replay and old-preview-schema forward replay must
both end at the canonical schema; search documents, caches, aggregates, and
effective projections are rebuilt from the new sources.

Operational sizing, query-plan evidence, backpressure, and the 500M/3B cutover
path are specified in [Tag Path capacity](./tag-path-capacity.md).
