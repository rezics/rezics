## ADDED Requirements

### Requirement: ReactionSummary changes invalidate ranking

Changes to `ReactionSummary` SHALL be treated as ranking invalidation inputs for the summary's `targetId`. The reaction service SHALL remain independent from ranking formulas and Meilisearch patching.

#### Scenario: Summary increment invalidates ranking
- **WHEN** a reaction create increments `ReactionSummary(targetId = "unit-1", reaction = "like")`
- **THEN** the CDC-to-queue path SHALL enqueue a ranking invalidation for `unit-1`

#### Scenario: Summary decrement invalidates ranking
- **WHEN** a reaction delete decrements `ReactionSummary(targetId = "unit-1", reaction = "like")`
- **THEN** the CDC-to-queue path SHALL enqueue a ranking invalidation for `unit-1`

### Requirement: Ranking consumes summaries through service boundary

Ranking recomputation SHALL obtain reaction counts through the reaction service summary API or an internal batch summary endpoint. Ranking SHALL NOT require direct writes to the reaction database and SHALL NOT make the main server embed reaction summaries in list responses.

#### Scenario: Ranking fetches current summary
- **WHEN** ranking recomputes scores for `unit-1`
- **THEN** it SHALL request the current reaction summary for `unit-1` through the reaction service boundary
- **AND** it SHALL use the returned current counts as ranking signals

#### Scenario: List responses remain summary-free
- **WHEN** a client receives a list/detail response from the main server
- **THEN** the response SHALL remain free of a `reactionSummaries` field
