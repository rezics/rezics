## ADDED Requirements

### Requirement: Creation flows are guided and recoverable

The app SHALL provide guided creation flows with type selection, existing-work/entity search, draft save, validation, preview, publish/submit, and post-submit next actions.

#### Scenario: User creates review draft

- **WHEN** a user starts a review and leaves before publishing
- **THEN** the draft SHALL be recoverable from the dashboard or relevant create surface

### Requirement: Creation uses shared contracts and editor infrastructure

Creation flows SHALL use `@rezics/contract`, `@rezics/api`, existing editor primitives, UnitTranslation language controls, Unit attribution, tags, and work-domain matching where applicable.

#### Scenario: App does not duplicate DTO

- **WHEN** a creation form needs book metadata
- **THEN** it SHALL consume typed API/contract schemas rather than defining app-local DTO copies

#### Scenario: User creates localized metadata

- **WHEN** a user creates or edits display metadata for a Unit-backed object
- **THEN** the form SHALL write the selected UnitTranslation language
- **AND** it SHALL NOT store localized title/summary/description in feature-local fields

### Requirement: Policy-aware publish states are visible

When policy requires review, rule acknowledgement, or account remediation, creation flows SHALL show the relevant blocking state and next action.

#### Scenario: Silenced user attempts publish

- **WHEN** a silenced user attempts to publish a post
- **THEN** the UI SHALL show a safe denial state returned by the server
- **AND** no optimistic publish success SHALL be shown

### Requirement: Empty-node placeholder is a recognized chapter creation entry

The "Create chapter" CTA rendered by the empty-node placeholder at `/book/:bookId/node/:nodeId` (specified by `type-extension-book`) SHALL be a recognized chapter creation entry alongside the unified `/create` route and any in-editor add-chapter affordance. A unified creation entry list (sidebar create menu, `/create` index, drafts surface) SHALL NOT remove or suppress this inline CTA, because it is the only entry that creates a chapter at a specific TOC position without forcing the author to navigate through a TOC picker.

Invoking the CTA SHALL materialize the chapter Unit via the existing materialization endpoint by `nodeId` (no path serialization) and SHALL reuse the editor primitives required by the "Creation uses shared contracts and editor infrastructure" requirement above.

#### Scenario: Author creates a chapter from the empty-node placeholder

- **GIVEN** an editor-permitted user opens `/book/:bookId/node/:nodeId` for a node whose `contentUnitId` is null and `isDeleted` is false
- **WHEN** the user activates the "Create chapter" CTA
- **THEN** the system SHALL materialize the chapter Unit and set `node.contentUnitId`
- **AND** the user SHALL land in a chapter editor surface for the newly materialized Unit
- **AND** the unified creation menu / `/create` route SHALL still list the empty-node CTA as a valid chapter creation entry in any documentation or contributor-facing inventory

#### Scenario: Reader without edit permission sees no Create chapter affordance

- **GIVEN** a reader without edit permission on the book
- **WHEN** they open `/book/:bookId/node/:nodeId` for an empty node
- **THEN** the placeholder SHALL describe the empty state without a Create chapter CTA
- **AND** no materialization request SHALL be triggered
