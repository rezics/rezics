## ADDED Requirements

### Requirement: Book Language Switching Resolves Through UnitWork Defaults

For release-aware books, changing language SHALL select a visible release in
the same hidden work domain using `UnitWorkLanguageDefault` and deterministic
fallbacks. It SHALL NOT treat every release translation as an equal top-level
language candidate.

#### Scenario: Switch to curated language default

- **GIVEN** the current release belongs to `work-x`
- **AND** `UnitWorkLanguageDefault(work-x, zh-hant) = release-zh`
- **WHEN** the user switches the book language to `zh-hant`
- **THEN** the page SHALL select or navigate to `release-zh`

#### Scenario: No language default falls back deterministically

- **GIVEN** no `UnitWorkLanguageDefault(work-x, de)` exists
- **WHEN** the user switches to `de`
- **THEN** the system SHALL attempt the documented fallback order
- **AND** if no release supports `de`, the UI SHALL show a no-content state rather than selecting an arbitrary release

### Requirement: Language Switcher Shows Primary Languages First

The book language switcher SHALL present primary work-language releases first.
Secondary releases in the same language SHALL be accessible through the release
selector, not as duplicate top-level language choices.

#### Scenario: Multiple releases share language

- **GIVEN** `work-x` has three Japanese releases
- **AND** `UnitWorkLanguageDefault(work-x, ja) = release-ja-main`
- **WHEN** the language switcher renders
- **THEN** Japanese SHALL appear once as a language option
- **AND** selecting it SHALL resolve `release-ja-main`

### Requirement: Language Defaults Follow Canonical Work After Merge

When a source work is merged into a target work, release language switching
SHALL resolve through the target canonical work after merge repair completes.
If source and target language defaults conflict, admin merge preview SHALL
surface the conflict and the merge operation SHALL apply the selected target
resolution.

#### Scenario: Merged source release switches through target work

- **GIVEN** release `release-a` belonged to source work `work-old`
- **AND** `work-old` has been merged into `work-new`
- **WHEN** the user switches language from `release-a`
- **THEN** the language switcher SHALL resolve candidates from `work-new`
- **AND** it SHALL NOT use stale defaults from `work-old` as the current
  canonical work defaults
