# unit-alias-search Specification

## Purpose

Defines `UnitAlias` rows that attach searchable alternative names
to a canonical Unit without creating a new identity or replacing
`UnitTranslation`. Owns the separation between display `value` and
NFKC-normalized `normalizedValue`, the one-vote-per-user
`UnitAliasVote` model that drives `score` and `voteCount`, the
"pinned-or-above-threshold" rule for inclusion in the search index
(without ranking boost), and the admin / owner authority gate over
pin / unpin / hide / delete operations.

## Requirements

### Requirement: UnitAlias stores searchable alternative names for a Unit
The system SHALL store searchable alternative names in `UnitAlias` rows attached to a canonical `Unit`. A UnitAlias SHALL NOT create a new Unit identity, SHALL NOT replace `UnitTranslation`, and SHALL NOT establish a canonical merge relationship between Units.

Each UnitAlias SHALL include `unitId`, `value`, `normalizedValue`, optional `language`, `kind`, `status`, `score`, `voteCount`, `pinned`, optional `position`, creator metadata, and timestamps.

#### Scenario: Alias attaches to an existing Unit
- **GIVEN** Unit `unit-1` exists
- **WHEN** a caller creates alias value `"3 Body Problem"` for `unit-1`
- **THEN** a `UnitAlias` row SHALL be persisted with `unitId = "unit-1"`
- **AND** no new Unit SHALL be created
- **AND** no `UnitTranslation` row SHALL be replaced

### Requirement: UnitAlias separates display value from normalized matching value
`UnitAlias.value` SHALL preserve the original submitted alias text for display, editing, moderation, audit, and vote context. `UnitAlias.normalizedValue` SHALL be a derived machine key used for matching and de-duplication.

The first-pass normalizer SHALL be conservative: trim whitespace, apply Unicode NFKC normalization, apply case folding where applicable, collapse whitespace, and normalize low-risk separator punctuation. It SHALL NOT automatically merge complex language variants such as simplified/traditional Chinese, kana/kanji, or romanization variants unless a later spec explicitly adds that rule.

#### Scenario: Display value is preserved
- **WHEN** a caller creates alias value `"  The Three-Body Problem  "`
- **THEN** the system SHALL preserve a display/audit value equivalent to the submitted title text after only accepted storage trimming
- **AND** the alias SHALL expose the user-facing text separately from `normalizedValue`

#### Scenario: Normalized value is used for duplicate detection
- **GIVEN** Unit `unit-1` already has an alias with normalized value `"the three-body problem"`
- **WHEN** a caller submits another alias whose normalized value is `"the three-body problem"`
- **THEN** the system SHALL treat the submission as targeting the existing alias row or reject it as a duplicate according to the alias creation endpoint contract

### Requirement: UnitAliasVote records user votes on alias usefulness
`UnitAliasVote` SHALL record one user's vote on one UnitAlias. A user SHALL hold at most one vote per alias. `UnitAlias.score` SHALL equal the sum of vote values for that alias, and `UnitAlias.voteCount` SHALL equal the count of votes for that alias.

#### Scenario: User upvotes an alias
- **GIVEN** UnitAlias `alias-1` exists
- **WHEN** user `user-1` casts `+1`
- **THEN** a `UnitAliasVote(alias-1, user-1, +1)` row SHALL exist
- **AND** the alias score and voteCount SHALL be recomputed from alias votes

#### Scenario: User changes alias vote
- **GIVEN** user `user-1` has a `+1` vote on `alias-1`
- **WHEN** user `user-1` casts `-1` on `alias-1`
- **THEN** the existing vote row SHALL be updated rather than duplicated
- **AND** `UnitAlias.score` SHALL reflect the vote delta

### Requirement: Pinned aliases remain searchable without ranking boost
When building searchable alias fields, the system SHALL include a UnitAlias if `score > visibilityThreshold OR pinned = true`. Pinned aliases SHALL remain searchable so owner/admin intent is respected, but pinning SHALL NOT modify the alias score, voteCount, search ranking score, or score-based ordering.

#### Scenario: Pinned low-score alias remains searchable
- **GIVEN** alias `alias-1` has `score = -120`
- **AND** `pinned = true`
- **WHEN** the owning Unit is indexed for search
- **THEN** `alias-1.value` SHALL be included in alias-derived searchable fields
- **AND** `alias-1.score` SHALL remain `-120`

#### Scenario: Unpinned low-score alias is excluded
- **GIVEN** alias `alias-2` has `score = -120`
- **AND** `pinned = false`
- **WHEN** the owning Unit is indexed for search
- **THEN** `alias-2.value` SHALL NOT be included in alias-derived searchable fields

#### Scenario: Pinned does not boost alias ranking
- **GIVEN** two search results match the same query through aliases
- **AND** one matching alias is pinned
- **WHEN** search results are ranked
- **THEN** the pinned alias SHALL NOT receive an extra ranking boost solely because it is pinned

### Requirement: Alias authority is separate from community voting
Creating community aliases and voting on aliases SHALL be available to authenticated users according to the alias endpoint rules. Pinning, unpinning, repositioning, hiding, or deleting aliases SHALL be restricted to platform administrators or the owning Unit's authorized owner/editor role.

#### Scenario: Unit owner pins an alias
- **GIVEN** Unit `unit-1` is owned by `user-owner`
- **AND** alias `alias-1` belongs to `unit-1`
- **WHEN** `user-owner` pins `alias-1`
- **THEN** `alias-1.pinned` SHALL become `true`
- **AND** the alias score SHALL remain unchanged

#### Scenario: Regular user cannot pin an alias
- **GIVEN** caller `user-x` is neither admin nor authorized owner/editor for `unit-1`
- **WHEN** `user-x` attempts to pin an alias on `unit-1`
- **THEN** the system SHALL deny the operation with an authorization error
