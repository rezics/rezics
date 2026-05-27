## ADDED Requirements

### Requirement: Ordinary Creation Is Release-Led

Ordinary public and personal creation flows SHALL create visible release Units,
not standalone hidden work Units. Creating a book through ordinary user-facing
flows SHALL mean creating a release and either linking it to an existing work
domain or creating the first release plus a new hidden work domain as part of
that release-led flow.

Admin repair/maintenance surfaces MAY create hidden work Units directly.

#### Scenario: Public catalog book creation creates a release

- **WHEN** a user creates a catalog book through the ordinary public creation
  flow
- **THEN** the created user-facing content SHALL be a visible BOOK release Unit
- **AND** the flow SHALL resolve or create the release's hidden work domain
- **AND** the flow SHALL NOT expose standalone hidden work creation as the
  primary action

#### Scenario: Admin manually creates hidden work

- **WHEN** an authorized admin uses a work-domain maintenance surface
- **THEN** the admin MAY create a hidden work Unit without creating a release in
  the same interaction
- **AND** that work Unit SHALL remain outside ordinary public book detail and
  reading flows until releases are attached

### Requirement: Creation Flow Prompts For Existing Work Matching

Creation surfaces for release-aware content SHALL guide users to search for an
existing work before creating a new release. Public catalog creation SHALL show
this guidance prominently. Personal creation SHALL keep the guidance quieter,
for example as help text or a tooltip attached to the work-selection row.

The guidance SHALL explain that translations, reprints, platform editions,
language versions, and other release variants should usually attach to an
existing work instead of starting a new work domain.

#### Scenario: Public creation shows prominent work guidance

- **WHEN** a user opens a public catalog book creation page
- **THEN** the page SHALL prominently prompt the user to search for an existing
  work/release before creating a new one
- **AND** the copy SHALL call out translations and language/platform versions as
  cases that should usually attach to an existing work

#### Scenario: Personal creation shows quiet work guidance

- **WHEN** a user opens a personal book creation page
- **THEN** the page SHALL provide work-matching guidance in a lower-emphasis
  affordance such as a help tooltip on the work row
- **AND** the page SHALL still allow the user to continue when they are adding a
  first-release/original work

### Requirement: Work Matching Uses Ordinary Content Search

Work matching during creation SHALL use ordinary content search results, such as
book search results, instead of exposing hidden work Units as the primary search
object. Selecting a matched release that already belongs to a work SHALL bind
the new release to that release's canonical work. Selecting a matched standalone
release MAY create or reuse a hidden work domain that contains both the matched
release and the new release.

#### Scenario: Search result with work binds new release

- **GIVEN** search result `release-a` belongs to canonical work `work-x`
- **WHEN** the user selects `release-a` as the matching existing content during
  creation
- **THEN** the new release SHALL be linked to `work-x`
- **AND** the user SHALL see the releases and tags already associated with
  `work-x` before or after confirmation

#### Scenario: Standalone matched release can become first work member

- **GIVEN** search result `release-a` has no work domain
- **WHEN** the user selects `release-a` as the matching existing content during
  creation
- **THEN** the system MAY create a hidden work domain for `release-a` and the
  new release
- **AND** the operation SHALL remain release-led rather than exposing a
  standalone work creation step to ordinary users

### Requirement: Selected Work Context Shows Releases And Tags

When creation or edit UI resolves a work domain, the UI SHALL show enough work
context to prevent accidental attachment. At minimum, it SHALL expose the
current releases under the work and the work's tag list or inherited tag summary.

#### Scenario: User reviews work context before binding

- **GIVEN** a creation form has resolved `work-x`
- **WHEN** the work context panel renders
- **THEN** it SHALL show existing releases under `work-x`
- **AND** it SHALL show work-level tags or inherited tag summary
- **AND** the user SHALL be able to distinguish the selected work from unrelated
  similarly titled content
