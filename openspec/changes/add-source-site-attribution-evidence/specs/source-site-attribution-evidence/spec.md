## ADDED Requirements

### Requirement: SourceSite extends Entity identity

The system SHALL represent a source site as an Entity Unit plus a `SourceSite` extension row. `SourceSite` SHALL store internal source configuration only and SHALL NOT duplicate display fields such as name, logo, description, summary, translations, or slug.

#### Scenario: Source site display data comes from Entity

- **WHEN** a client reads a SourceSite for Qidian
- **THEN** the response SHALL include SourceSite configuration
- **AND** display identity such as title, avatar, slug, verified status, and description SHALL be resolved from the linked Entity Unit

#### Scenario: SourceSite rejects duplicated display fields

- **WHEN** an admin creates or updates a SourceSite
- **THEN** the writable SourceSite payload SHALL NOT accept site display fields such as `name`, `logo`, `description`, or `homepageUrl`

### Requirement: SourceSite key is internal and stable

The system SHALL assign each SourceSite an internal `key` that is unique across SourceSite rows. The key SHALL be used for code, import, crawler, and rule lookup, and SHALL NOT be treated as user-facing display text.

#### Scenario: Duplicate source key is rejected

- **GIVEN** a SourceSite exists with `key = "qidian"`
- **WHEN** an admin creates another SourceSite with `key = "qidian"`
- **THEN** the system SHALL reject the write

#### Scenario: UI renders Entity title instead of key

- **WHEN** an app or admin surface displays a SourceSite
- **THEN** it SHALL render the linked Entity title as the primary label
- **AND** it MAY show the key only as technical metadata

### Requirement: SourceSite crawl gates are explicit

The system SHALL store crawl support separately from operational crawl enablement. A source SHALL be schedulable only when `crawlSupport = "supported"`, `crawlerAdapterKey` is present, and `crawlEnabled = true`.

#### Scenario: Supported but disabled source is not scheduled

- **GIVEN** a SourceSite has `crawlSupport = "supported"`
- **AND** `crawlerAdapterKey = "qidian"`
- **AND** `crawlEnabled = false`
- **WHEN** the crawler scheduler evaluates the source
- **THEN** it SHALL NOT schedule crawl jobs for that source

#### Scenario: Enabled source without adapter is not scheduled

- **GIVEN** a SourceSite has `crawlSupport = "planned"`
- **AND** `crawlEnabled = true`
- **WHEN** the crawler scheduler evaluates the source
- **THEN** it SHALL NOT schedule crawl jobs for that source

#### Scenario: Supported enabled source can be scheduled

- **GIVEN** a SourceSite has `crawlSupport = "supported"`
- **AND** `crawlerAdapterKey = "qidian"`
- **AND** `crawlEnabled = true`
- **WHEN** the crawler scheduler evaluates the source
- **THEN** it SHALL treat the source as eligible for crawl scheduling

### Requirement: Source reference rules are contract-validated

The system SHALL validate SourceSite reference rules through `@rezics/contract` before persistence. Reference rules MAY define external kinds, id names, URL templates, URL match patterns, and crawler action keys, but observed external ids and observed URLs SHALL be stored in UnitExternalRef rows instead of the rules JSON.

#### Scenario: Valid reference rule is accepted

- **WHEN** an admin saves a SourceSite rule for `externalKind = "book"` with a URL template and URL match pattern
- **THEN** the system SHALL persist the SourceSite configuration

#### Scenario: Invalid reference rule is rejected

- **WHEN** an admin saves a SourceSite rule whose URL template is malformed or whose external kind is missing
- **THEN** the system SHALL reject the write with a validation error

### Requirement: UnitExternalRef stores source-scoped external identities

The system SHALL store external identities for Units in `UnitExternalRef`. Each row SHALL reference a Unit and a SourceSite, and SHALL include an external kind, external id, canonical URL or derivable URL data, original URL when available, and observation timestamps.

#### Scenario: Book has Qidian external reference

- **GIVEN** a Book Unit exists
- **AND** a Qidian SourceSite exists
- **WHEN** the system records `externalKind = "book"` and `externalId = "123"`
- **THEN** it SHALL create a UnitExternalRef linking the Book Unit to the Qidian SourceSite

#### Scenario: Entity has source external reference

- **GIVEN** an Entity Unit represents a publisher
- **AND** a source exposes a publisher identity
- **WHEN** the system records that source identity
- **THEN** it SHALL use UnitExternalRef for the Entity Unit instead of creating a separate EntityExternalRef table

#### Scenario: Duplicate source-issued identity is rejected

- **GIVEN** a UnitExternalRef exists for `(sourceSiteEntityUnitId, externalKind, externalId)`
- **WHEN** another UnitExternalRef is created with the same source site, external kind, and external id
- **THEN** the system SHALL reject the duplicate identity

### Requirement: Credit attribution evidence links to existing credit rows

The system SHALL store source evidence for credit attributions in `CreditAttributionEvidence`. Each evidence row SHALL reference an existing `CreditAttribution(unitId, entityId, role)` and an existing UnitExternalRef.

#### Scenario: Publisher evidence is linked

- **GIVEN** a Book Unit has `CreditAttribution(role = "publisher")` linking to a publisher Entity
- **AND** the Book Unit has a Qidian UnitExternalRef
- **WHEN** the system records source evidence for the publisher claim
- **THEN** it SHALL create CreditAttributionEvidence linked to the credit attribution and UnitExternalRef

#### Scenario: Evidence without credit attribution is rejected

- **GIVEN** no `CreditAttribution(unitId, entityId, role)` exists for a submitted evidence row
- **WHEN** the system attempts to persist that evidence
- **THEN** the system SHALL reject the write

#### Scenario: Evidence records claim path and observation

- **WHEN** the system records credit attribution evidence
- **THEN** it SHALL store the source claim path
- **AND** it SHALL store the observed URL when available
- **AND** it SHALL store the observation timestamp

### Requirement: Credit attribution DTOs expose optional evidence

Credit attribution read DTOs SHALL include source evidence only when evidence exists. Existing clients SHALL remain valid when evidence is absent.

#### Scenario: Credit without evidence remains readable

- **GIVEN** a CreditAttribution has no evidence rows
- **WHEN** a client reads credits for the Unit
- **THEN** the response SHALL include the credit attribution
- **AND** the response SHALL NOT require any source evidence fields

#### Scenario: Credit with evidence includes source summary

- **GIVEN** a CreditAttribution has one or more evidence rows
- **WHEN** a client reads credits for the Unit
- **THEN** the response SHALL include evidence summaries with source site identity, source URL data, claim path, and observation metadata

### Requirement: Admin can manage source sites through Entity-bound pages

The admin app SHALL provide SourceSite management surfaces that bind SourceSite rows to existing Entity Units. Admin users SHALL be able to create, edit, list, and inspect SourceSite configuration without editing duplicated display fields.

#### Scenario: Admin creates SourceSite for existing Entity

- **GIVEN** an Entity Unit exists for Qidian
- **WHEN** an admin creates a SourceSite with that Entity Unit and `key = "qidian"`
- **THEN** the SourceSite SHALL be persisted as an extension of that Entity

#### Scenario: Admin edits crawl enablement

- **GIVEN** a SourceSite exists
- **WHEN** an admin toggles crawl enablement
- **THEN** the system SHALL update `crawlEnabled`
- **AND** it SHALL NOT modify the linked Entity display data

### Requirement: Source-backed credit attribution preview

The app SHALL provide an accessible preview interaction for source-backed credit attributions. Credit attributions without evidence SHALL continue to navigate directly to the linked Entity detail page.

#### Scenario: Credit without evidence navigates directly

- **GIVEN** a rendered credit attribution has no source evidence
- **WHEN** the user activates the attribution
- **THEN** the app SHALL navigate directly to the linked Entity detail page

#### Scenario: Credit with evidence opens preview

- **GIVEN** a rendered credit attribution has source evidence
- **WHEN** the user hovers, focuses, taps, or activates the attribution preview trigger
- **THEN** the app SHALL show a preview containing the Entity identity, credit role, source site identity, source URL action, and Entity detail action

#### Scenario: Source URL uses safe outbound link

- **WHEN** the preview renders an action to open the source URL
- **THEN** the action SHALL use the shared safe-link behavior for outbound URLs
