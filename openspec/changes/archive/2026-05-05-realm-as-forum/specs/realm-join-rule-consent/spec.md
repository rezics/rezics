## ADDED Requirements

### Requirement: JoinButton checks realm.extra.rule before joining

When a user clicks `JoinButton` on a realm whose `extra.rule` is set to a unit id, the frontend SHALL NOT immediately call the join API. Instead, it SHALL fetch the referenced Post via `unitDetailQuery` and open a rule-consent modal. The join API SHALL be called only after the user explicitly clicks "Agree and Join" in the modal.

When `extra.rule` is unset (or empty), the existing zero-step join behaviour SHALL be preserved — clicking JoinButton SHALL call the join API directly without a modal.

This requirement is a frontend-only change. The server-side join endpoint SHALL NOT be modified, SHALL NOT receive any consent flag, and SHALL NOT track per-user rule acknowledgments.

#### Scenario: Join with no rule is one-click

- **GIVEN** realm-1 with `extra.rule` unset
- **WHEN** an authenticated non-member clicks JoinButton
- **THEN** the join API SHALL be called directly
- **AND** no modal SHALL be rendered
- **AND** the user SHALL become a member

#### Scenario: Join with rule shows modal

- **GIVEN** realm-1 with `extra.rule = "post-rule-1"`
- **WHEN** an authenticated non-member clicks JoinButton
- **THEN** the frontend SHALL fetch `unitDetailQuery("post-rule-1")` (and the Post's body resource as needed for body rendering)
- **AND** a modal SHALL render with the rule Post's content
- **AND** the join API SHALL NOT yet have been called

#### Scenario: User agrees and joins

- **GIVEN** the rule-consent modal is open for realm-1
- **WHEN** the user clicks "Agree and Join"
- **THEN** the join API SHALL be called
- **AND** the modal SHALL close
- **AND** the user SHALL become a member

#### Scenario: User dismisses modal without joining

- **GIVEN** the rule-consent modal is open for realm-1
- **WHEN** the user closes the modal (clicks Cancel or outside)
- **THEN** the join API SHALL NOT be called
- **AND** the user SHALL remain a non-member
- **AND** JoinButton SHALL remain available for another attempt

### Requirement: Rule modal renders the Post via the existing pinboard pipeline

The rule-consent modal SHALL render the rule Post's title, summary/body, and any author/timestamp metadata using the same pipeline established for `pinboard` entries: fetch the Unit, resolve display text via `getTranslation(unit.translations, language, defaultLanguage)`, fall back to default language if user language is unavailable. For body content, the modal SHALL prefer the release whose `defaultLanguage` matches the user's current language (selected from `unit.releases` via the work-release self-relation), falling back to the work Post itself when no language-matching release exists.

#### Scenario: Rule renders in user's language

- **GIVEN** realm-1's `extra.rule = "post-rule-en"`
- **AND** post-rule-en has a release `post-rule-zh` (with `workUnitId = post-rule-en.unitId`, `defaultLanguage = "zh-hant"`)
- **WHEN** a user with locale `zh-hant` opens the rule modal
- **THEN** the body content SHALL come from `post-rule-zh`
- **AND** the title SHALL come from `unit.translations` keyed by `zh-hant`

#### Scenario: Rule falls back to default language

- **GIVEN** realm-1's `extra.rule = "post-rule-en"` with no `zh-hant` release
- **WHEN** a user with locale `zh-hant` opens the rule modal
- **THEN** the body and title SHALL come from `post-rule-en`'s default language (English)

#### Scenario: Missing rule Post handles gracefully

- **GIVEN** realm-1's `extra.rule = "deleted-post"` and that Unit no longer exists or has `status = DELETED`
- **WHEN** a user clicks JoinButton
- **THEN** the modal SHALL display a graceful "rule unavailable" message
- **AND** an "agree and join" button SHALL still be available
- **AND** the user SHALL be able to proceed with joining

### Requirement: Joining counts as consent; no acknowledgment record exists

The system SHALL NOT maintain any per-user-per-rule acknowledgment record. The only evidence that a user agreed to the rule SHALL be the `RealmMember` row that joining creates. Removing membership (leaving the realm) and re-joining SHALL re-trigger the rule modal — leaving voluntarily revokes implicit ongoing consent, and rejoining requires a fresh consent click.

When a realm owner updates the rule Post (or its releases), existing members SHALL NOT be re-prompted by the system. Owners are expected to surface material rule changes through `pinboard`, `announcement`, or out-of-band notification channels. This trade-off is documented as part of the design — proving compliance with specific rule versions is out of scope.

#### Scenario: No acknowledgment table exists

- **GIVEN** the system after this change is deployed
- **WHEN** a developer inspects the database schema
- **THEN** there SHALL NOT be any table named `RuleAcknowledgement`, `RealmRuleAck`, or similar
- **AND** the `RealmMember` row SHALL be the only record of having joined

#### Scenario: Re-joining after leaving re-shows the rule

- **GIVEN** a user joined realm-1 (saw the rule modal), then left
- **WHEN** the user clicks JoinButton on realm-1 again
- **THEN** the rule modal SHALL appear again
- **AND** the user SHALL re-click "Agree and Join" to rejoin

#### Scenario: Existing members are not re-prompted on rule update

- **GIVEN** a user is already a member of realm-1
- **AND** the realm owner updates `extra.rule` to point to a new Post
- **WHEN** the existing member visits the realm
- **THEN** no rule modal SHALL appear automatically
- **AND** the user's membership SHALL remain valid
