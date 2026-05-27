## ADDED Requirements

### Requirement: Ranking lane and commands are part of the job contract

The job system SHALL define a dedicated ranking lane and typed `ranking.*` command schemas in `@rezics/job`. Ranking commands SHALL be more specific than the lane and SHALL identify the logical ranking operation being requested.

#### Scenario: Ranking invalidation command validates
- **WHEN** a producer creates a `ranking.invalidate` command for `unit-1`
- **THEN** the command SHALL validate through the shared `@rezics/job` command schemas
- **AND** it SHALL target the ranking lane

### Requirement: Main database CDC routes ranking invalidations

The Sequin webhook routing for the main database SHALL enqueue ranking invalidations for canonical table changes that affect rankable Unit projections, including Unit publication state, Post reply metadata, ScoreEntry/ScoreAggregate scoring state, UserUnitProgress activity state, and UnitRealm scope membership.

#### Scenario: Post update invalidates post ranking
- **WHEN** Sequin delivers an update for a `Post` row
- **THEN** the job-runner SHALL enqueue a ranking invalidation for that post `unitId`

#### Scenario: Progress update invalidates content ranking
- **WHEN** Sequin delivers an update for `UserUnitProgress(unitId = "book-1")`
- **THEN** the job-runner SHALL enqueue a ranking invalidation for `book-1`

#### Scenario: Realm membership update invalidates scoped ranking
- **WHEN** Sequin delivers an insert or delete for `UnitRealm(realmUnitId = "realm-1", unitId = "post-1")`
- **THEN** the job-runner SHALL enqueue a ranking invalidation for `post-1`
- **AND** the invalidation SHALL retain enough source metadata to identify the affected realm scope

### Requirement: Reaction database CDC routes ReactionSummary invalidations

The job-runner SHALL support a reaction database CDC source that watches `ReactionSummary` changes and routes insert, update, and delete messages to ranking invalidations keyed by `ReactionSummary.targetId`.

#### Scenario: Reaction summary update invalidates target ranking
- **WHEN** Sequin delivers an update for `ReactionSummary(targetId = "unit-1", reaction = "like")`
- **THEN** the job-runner SHALL enqueue a ranking invalidation for `unit-1`

#### Scenario: Reaction summary delete invalidates target ranking
- **WHEN** Sequin delivers a delete for `ReactionSummary(targetId = "unit-1", reaction = "like")`
- **THEN** the job-runner SHALL enqueue a ranking invalidation for `unit-1`

### Requirement: Ranking CDC routing treats payloads as invalidation

Ranking CDC routing SHALL treat CDC messages as invalidation signals only. It SHALL NOT rely on webhook payload fields as the authoritative reaction count, score count, progress state, or ranking score.

#### Scenario: CDC payload is not final rank state
- **WHEN** a ranking invalidation is produced from any CDC message
- **THEN** the resulting command SHALL identify the logical target and source metadata
- **AND** it SHALL NOT contain a precomputed hot, top, trending, or quality score
