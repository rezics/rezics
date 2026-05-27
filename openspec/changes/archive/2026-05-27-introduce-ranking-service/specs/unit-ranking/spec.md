## ADDED Requirements

### Requirement: Ranking service owns Unit rank projections

The system SHALL provide a `@rezics/ranking` service backed by PostgreSQL. The service SHALL store rank projections keyed by `unitId`, `scopeKind`, optional `scopeId`, and `rankKind`. Projection rows SHALL include numeric `hotScore`, `topScore`, `trendingScore`, and `qualityScore` fields, a `formulaVersion`, a `signalSnapshot`, and timestamps for computation and serving patch state.

#### Scenario: Projection exists for a global content unit
- **WHEN** ranking recomputes a published book Unit for the global content scope
- **THEN** the ranking database SHALL contain a projection keyed by that book `unitId`, `scopeKind = "global"`, `scopeId = null`, and `rankKind = "content"`
- **AND** the projection SHALL contain numeric hot, top, trending, and quality scores

#### Scenario: Projection exists for a realm post
- **WHEN** ranking recomputes a post Unit that belongs to realm `realm-1`
- **THEN** the ranking database SHALL contain a projection keyed by that post `unitId`, `scopeKind = "realm"`, `scopeId = "realm-1"`, and `rankKind = "post"`

### Requirement: Ranking commands are durable and idempotent

The system SHALL define typed `ranking.*` job commands in `@rezics/job`. Ranking invalidation commands SHALL use stable idempotency keys derived from the logical ranking target so duplicate CDC deliveries coalesce while a command is pending.

#### Scenario: Duplicate invalidations coalesce
- **WHEN** two CDC messages invalidate ranking for the same `unitId` before the first command is processed
- **THEN** both enqueue attempts SHALL be accepted
- **AND** the queue MAY retain only one pending ranking invalidation for that logical target

#### Scenario: Recompute command targets one unit
- **WHEN** an operator enqueues `ranking.recompute` for `unit-1`
- **THEN** the ranking worker SHALL recompute projections for `unit-1` from current canonical state

### Requirement: Ranking recomputation reads current canonical state

Ranking workers SHALL treat incoming commands as invalidations. Workers SHALL read current canonical state from the main database, the reaction summary API, and ranking-owned signal buckets before computing projections. Workers SHALL NOT compute final rank by applying ordered CDC deltas from webhook payloads.

#### Scenario: Reaction summary update triggers current-state recompute
- **WHEN** a `ReactionSummary` CDC update invalidates target `unit-1`
- **THEN** ranking SHALL fetch the current reaction summary for `unit-1`
- **AND** ranking SHALL compute scores from the fetched current state rather than the CDC update payload alone

### Requirement: Ranking patches Meilisearch serving fields

After storing a projection, ranking SHALL patch the corresponding Meilisearch document fields required for list sorting. Content Units SHALL patch the `content` index when eligible for content indexing. Post Units SHALL patch the `posts` index when eligible for post indexing.

#### Scenario: Content projection patches content document
- **WHEN** ranking stores a global content projection for book `book-1`
- **THEN** the `content` Meilisearch document with id `book-1` SHALL be patched with the projection's ranking fields

#### Scenario: Post projection patches post document
- **WHEN** ranking stores a post projection for post `post-1`
- **THEN** the `posts` Meilisearch document with id `post-1` SHALL be patched with the projection's ranking fields

### Requirement: Comment ranking preserves thread structure

Comment ranking SHALL apply to sibling comment sets within the same parent/root scope. The system SHALL NOT flatten an entire comment tree and sort all descendants globally for threaded comment display.

#### Scenario: Top-level comments sort by comment hot score
- **WHEN** a client requests top-level comments for root post `root-1` sorted by hot
- **THEN** the query SHALL filter to the relevant sibling set before sorting by comment ranking fields

#### Scenario: Replies sort within their parent
- **WHEN** a client expands replies under comment `comment-1` sorted by hot
- **THEN** the query SHALL filter to `parentPostUnitId = "comment-1"` before sorting by comment ranking fields

### Requirement: View and read signals are bucketed

High-frequency view and read signals SHALL be aggregated into ranking-owned buckets before recomputing projections. The system SHALL NOT patch Meilisearch once per individual view event.

#### Scenario: View event updates bucket
- **WHEN** a view event is accepted for `unit-1`
- **THEN** ranking SHALL aggregate it into a time bucket for `unit-1`
- **AND** Meilisearch SHALL NOT be patched synchronously for that individual event

### Requirement: Ranking service exposes repair and debug operations

The ranking service SHALL expose internal or admin operations to inspect a unit's ranking projection, trigger recompute for one unit, trigger full sync in bounded segments, and patch serving projections from stored ranking rows.

#### Scenario: Operator inspects projection
- **WHEN** an authorized operator requests ranking debug data for `unit-1`
- **THEN** the response SHALL include projection scores, formula version, signal snapshot, and last computed timestamp

#### Scenario: Full sync resumes by cursor
- **WHEN** a ranking full sync segment reaches its configured limit
- **THEN** the operation SHALL return or enqueue a continuation cursor rather than processing an unbounded number of Units in one job
