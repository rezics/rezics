## ADDED Requirements

### Requirement: Zone supports wiki configuration
The Zone contract SHALL support an optional wiki configuration object for Zones whose template is a wiki template. The configuration SHALL include base wiki filters, navigation config, homepage config, and theme config using typed schemas.

#### Scenario: Wiki Zone config validates
- **WHEN** a Zone is saved with wiki filters, navigation, homepage sections, and theme tokens
- **THEN** the server SHALL validate those fields against the wiki Zone schemas

#### Scenario: Non-wiki Zone unaffected
- **WHEN** an existing non-wiki Zone has no wiki configuration
- **THEN** it SHALL continue to validate and render under existing Zone behavior

### Requirement: Zone filters support wiki realm content
Zone filters SHALL be able to express wiki realm content using realm id, Unit type, post kind, tags, language, entity subjects, and translation group references where applicable.

#### Scenario: Zone filters WIKI posts in realm
- **WHEN** a wiki Zone config specifies `realmUnitId = "realm-fate"` and `postKind = "WIKI"`
- **THEN** Zone queries SHALL restrict content to WIKI Post Units sent to `realm-fate`

### Requirement: Zone stores typed wiki config rather than arbitrary JSON
Although Zone configuration may be persisted in JSON fields, public create/update APIs SHALL validate the shape with contract schemas and SHALL reject unknown top-level wiki configuration fields.

#### Scenario: Unknown wiki config field rejected
- **WHEN** a caller submits a wiki Zone config containing `unsupportedFeature = true`
- **THEN** schema validation SHALL reject the request
