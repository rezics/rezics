# Tag structures

Rezics represents a structured Tag relationship as a community-immutable
generic `structure` Unit. The first semantic structure kind is
`tag.hierarchy_path`: an ordered path of two to sixteen Tag Units from broader
to more specific.

## Development preview boundary

Tag paths are not released to ordinary users. Dedicated hierarchy, structure,
application, vote, and `tag-structures` search operations require
`platform.development_preview.access` in addition to their ordinary API scope
and domain authorization. Mixed Unit Tag responses omit structures before
querying them when the caller lacks the capability, while continuing to return
released flat and Realm Tag data.

The frontend mirrors this decision by removing path routes, search controls,
management controls, and rendered paths. That client behavior is presentation
only; the backend remains authoritative on every request.

## Identity and immutability

The exact ordered member UUID array, structure kind, and definition version
form the current definition identity used for deduplication.
`unit_structure_member` and `unit_structure_edge` are database-generated
projections of that header. They provide referential integrity and inverse
indexes but are not independently editable.

The database validates that a new Tag path:

- has distinct members;
- contains only active, approved, public Tag Units; and
- satisfies the bounded path length.

After insertion the header, members, and edges reject ordinary direct
mutation. The submitter receives attribution and an initial positive vote, but
no editing authority; the Community Profile owns the Unit.

The sole exception is an administrative correction by a Profile with the
platform `unit.edit` capability. The API requires the last observed
`updatedAt` value and a non-empty correction reason. The database then replaces
the ordered members through a transaction-local guarded path, rebuilds member,
edge, and effective-Tag projections, and records both a Unit revision and an
audit event. The Structure Unit identity, definition votes, applications, and
application votes are preserved.

The correction is rejected atomically if it duplicates another exact path,
contains an existing application target, or would turn a positive Structure
application into support that conflicts with the same Profile's negative
direct Tag vote. Community endpoints never receive the guarded mutation
authority.

## Two independent global votes

`unit_structure_vote` answers whether an immutable definition is a valid path.
It drives Tag hierarchy pages and search discoverability.

`unit_structure_application_vote` answers whether that structure applies to one
target Unit. A positive vote supplies one positive judgment for every member
Tag. A negative vote rejects the application only; it does not cast negative
votes on the member Tags.

Realm-scoped definition and application votes are intentionally deferred. They
must be modeled as separate authorities and aggregates rather than merged into
the global scores.

## Effective Tag projection

Direct Tag applications remain authoritative facts in `unit_tag`. Positive
structure-application votes create provenance rows in
`unit_tag_structure_support`.

Database-maintained `unit_effective_tag` and `unit_effective_tag_vote` tables
collapse those sources:

- a Tag context exists when it has a direct application or any structure
  support;
- a profile's direct Tag vote takes precedence;
- otherwise any number of positive structure paths becomes exactly one
  positive effective vote for that profile, target Unit, and Tag; and
- a negative direct vote and positive structure support from the same profile
  cannot coexist.

Tag aggregates, Tag filtering, and the current search projection read the
effective tables. Provenance remains available for explanation and rebuilding.
Projection refreshes and aggregate refreshes take transaction-scoped advisory
locks keyed by the affected target, Tag, Structure, and Profile dimensions.
Application-vote changes and administrative definition corrections share the
Structure-definition lock, so a correction rebuilds from a committed vote set.
Unrelated votes remain concurrent while same-key recomputation cannot lose a
concurrent committed change.

## Presentation and hierarchy

A structure is rendered on a Unit only when both its definition score and its
application score are positive. Rendered structure members are omitted from
the flat global Tag list. Rejected or truncated structures do not suppress flat
Tags.

A Tag page reads only accepted adjacent edges. It displays a bounded set of
direct children and one additional bounded hop for each child. Duplicate edges
from multiple paths collapse to the strongest accepted definition and are
ranked with the Wilson lower bound, then stable score, count, and UUID
tie-breakers.

The search projection indexes accepted structures as `tag-structures`. Its
display title and searchable text are derived live from ordered member Tag
localizations and accepted aliases. Member localization, lifecycle, alias, and
definition-vote changes fan out search invalidations to dependent structure
documents.

## Cost model

Let `L` be path length, bounded at 16.

- Definition creation, member/edge projection, and one positive application
  vote are `O(L)`.
- An administrative correction is `O(L + A×L)`, where `A` is the number of
  positive application votes whose support provenance must be rebuilt. It is a
  rare platform-authorized operation and does not add cost to ordinary reads or votes.
- Projection locking is partitioned by logical key; a vote contends only with
  another change that can affect the same effective fact or aggregate.
- Exact-path deduplication is a B-tree lookup on the bounded UUID array.
- Inverse membership and adjacent navigation use indexed narrow tables.
- Effective Tag lookup is keyed by `(unit_id, tag_id)`; per-profile vote
  deduplication is keyed by `(unit_id, tag_id, profile_id)`.
- Unit rendering reads a bounded number of accepted structures plus a bounded
  flat Tag list.
- Tag hierarchy reads indexed one-hop edges twice. It does not maintain a
  transitive closure or run an unbounded recursive query.

This favors the common write/read paths while keeping the rare “Tag plus all
descendants” query out of the core storage cost. If descendant workloads become
material, a versioned asynchronous closure projection can be added without
changing structure identity or votes.
