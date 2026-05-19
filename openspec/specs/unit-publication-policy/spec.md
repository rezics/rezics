## Purpose

Defines how publishable Units (BOOK, GAME, MEDIA, POST, SHELF) carry a single publication license slug, how that slug is validated against the shared license registry, how composer flows resolve license defaults from platform, user, and realm preferences, and how Unit `status` and `visibility` jointly determine public discoverability. Keeps Unit publication license metadata distinct from licensed-work (`isLicensed`) metadata on Book/Game/Media.

## Requirements

### Requirement: Unit publication metadata defines a single license
The system SHALL represent the publication license for a Unit as one effective license slug. License display text SHALL be resolved from the shared license registry's slug-to-i18n-key mapping, not from Unit-owned free text.

#### Scenario: Unit has an explicit license
- **WHEN** a publishable Unit is created with a valid license slug
- **THEN** the Unit publication metadata SHALL store that slug as the Unit's effective license

#### Scenario: Multiple license slugs are submitted
- **WHEN** a client submits multiple license slugs for one Unit
- **THEN** the server SHALL reject the request instead of storing a license array

### Requirement: License slugs come from the shared registry
The system SHALL validate Unit license slugs against a shared contract registry.

#### Scenario: Known license slug is accepted
- **WHEN** a client submits `cc-by-4.0` as a Unit license slug
- **THEN** contract validation and server validation SHALL accept the slug

#### Scenario: Unknown license slug is rejected
- **WHEN** a client submits a license slug that is not in the registry
- **THEN** the server SHALL reject the request with a client error

### Requirement: License defaults are resolved before publishing
The system SHALL resolve composer license defaults from platform default, user preference, active realm preference, and explicit composer selection.

#### Scenario: Realm default pre-fills composer
- **WHEN** a user opens a composer in a realm with a default license
- **THEN** the composer SHALL prefill the realm default over the user's default
- **AND** the user SHALL be able to choose another valid license before publishing

#### Scenario: Existing content is not dynamically inherited
- **WHEN** a user or realm changes its default license
- **THEN** existing Units SHALL keep their stored effective license slug

### Requirement: Publishing license is distinct from licensed-work status
The system SHALL keep Unit publication license metadata separate from Book/Game/Media `isLicensed` metadata.

#### Scenario: Licensed work search remains unchanged
- **WHEN** a user filters search results by licensed works
- **THEN** the filter SHALL continue to use the existing `isLicensed` meaning
- **AND** it SHALL NOT infer results from Unit publication license slug

### Requirement: Public eligibility is status and visibility based
The system SHALL treat a Unit as publicly discoverable only when it is `PUBLISHED` and `PUBLIC`.

#### Scenario: Private published Unit is not publicly discoverable
- **WHEN** a Unit has `status=PUBLISHED` and `visibility=PRIVATE`
- **THEN** public list and public search surfaces SHALL exclude it

#### Scenario: Deleted public Unit is not publicly discoverable
- **WHEN** a Unit has `status=DELETED` and `visibility=PUBLIC`
- **THEN** public list and public search surfaces SHALL exclude it
