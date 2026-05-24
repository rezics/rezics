## ADDED Requirements

### Requirement: History reads tolerate invalid optional restore metadata

The history service SHALL NOT fail a revision timeline or single-revision
response solely because an optional persisted `restoreSource` value is null,
empty, or malformed. Invalid optional restore metadata SHALL be omitted from the
response DTO, while valid restore metadata SHALL be returned unchanged.

#### Scenario: Empty restoreSource is omitted

- **GIVEN** a `UnitRevision` row whose persisted `restoreSource` is `{}`
- **WHEN** the history service maps the row for a timeline response
- **THEN** the response item SHALL omit `restoreSource`
- **AND** response validation SHALL pass

#### Scenario: Valid restoreSource is preserved

- **GIVEN** a `UnitRevision` row whose persisted `restoreSource` is
  `{ kind: "revision", unitId: "unit-1", sequence: 7, paths: ["title"] }`
- **WHEN** the history service maps the row for a single-revision response
- **THEN** the response revision SHALL include that `restoreSource`
- **AND** response validation SHALL pass

#### Scenario: Malformed restoreSource is omitted

- **GIVEN** a `UnitRevision` row whose persisted `restoreSource` is missing
  `kind`, `unitId`, `sequence`, or an all-string `paths` array
- **WHEN** the history service maps the row
- **THEN** the response revision SHALL omit `restoreSource`
- **AND** response validation SHALL pass

### Requirement: Restore edit mode surfaces history read failures

The Book edit page SHALL show a visible error state when restore edit mode is
active and the requested revision fails to load. The page SHALL NOT silently show
only the normal restore notice when the revision query has failed.

#### Scenario: Restore revision query fails

- **GIVEN** the Book edit page URL contains `restoreRevision=12`
- **WHEN** the history revision query returns an error
- **THEN** the page SHALL display a destructive error alert describing that the
  revision failed to load
- **AND** the page SHALL NOT present the restore state as ready

### Requirement: Restore edit saves require loaded revision content

The Book edit page SHALL require the requested restore revision to be
successfully loaded before allowing a restore-mode submit. A restore-mode submit
SHALL be disabled or blocked while the revision query is loading, failed, or
missing the content payload needed to apply the restore safely.

#### Scenario: Submit disabled while restore revision is loading

- **GIVEN** the Book edit page URL contains `restoreRevision=12`
- **AND** the revision query is still loading
- **WHEN** the user views the submit control
- **THEN** the submit control SHALL be disabled or the submit handler SHALL block
  the save with a visible error

#### Scenario: Submit disabled after restore revision failure

- **GIVEN** the Book edit page URL contains `restoreRevision=12`
- **AND** the revision query failed
- **WHEN** the user attempts to save
- **THEN** the save SHALL NOT send restore-derived metadata
- **AND** the page SHALL show a visible error

### Requirement: Ordinary editing remains independent of history reads

Ordinary Book editing without a restore revision SHALL remain usable when the
history service is unavailable. History read failures SHALL block only workflows
that explicitly depend on a requested historical revision.

#### Scenario: Normal edit has no restore revision

- **GIVEN** the Book edit page URL does not contain `restoreRevision`
- **WHEN** the history service is unavailable
- **THEN** the normal edit submit flow SHALL remain available
- **AND** no restore-mode error alert SHALL be shown
