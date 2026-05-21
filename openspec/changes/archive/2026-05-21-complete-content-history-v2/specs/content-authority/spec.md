## ADDED Requirements

### Requirement: Public history visibility follows Unit visibility

History visibility SHALL follow the current Unit visibility gate. A viewer who can access the current Unit MAY access its public history metadata; a viewer who cannot access the Unit SHALL NOT access its history timeline, revision detail, or compare view.

#### Scenario: Public Unit history is visible

- **WHEN** a viewer can access a public Unit
- **THEN** the viewer SHALL be able to request the Unit's revision timeline metadata

#### Scenario: Private Unit history is hidden from non-owner

- **WHEN** a viewer cannot access a private Unit
- **THEN** history requests for that Unit SHALL be rejected or hidden consistently with the Unit resolver visibility rules

### Requirement: Raw history payload visibility is privileged

Raw revision content and raw structure-event payloads SHALL be visible only to actors with maintainer, owner, admin, or an explicit history-debug permission. Public viewers SHALL receive product-safe display data, not raw JSON payloads.

#### Scenario: Public viewer cannot inspect raw payload

- **WHEN** a public viewer opens a revision detail
- **THEN** the UI SHALL NOT expose raw JSON payload controls
- **AND** API responses SHALL NOT require raw payload visibility for basic timeline display

#### Scenario: Admin can inspect raw payload

- **WHEN** an admin opens a revision detail
- **THEN** the UI MAY expose a raw payload panel
- **AND** the API SHALL allow the raw payload when the admin is authorized

### Requirement: Restore obeys normal edit authority

Editorial restore SHALL be executed through normal edit/save paths and SHALL obey the same owner, collaborator, admin, and field-lock authority rules as any other edit. Restore SHALL create a new history revision rather than modifying or deleting prior revisions.

#### Scenario: Locked field blocks restore

- **WHEN** a non-admin actor attempts to restore a revision that changes a locked field
- **THEN** the save SHALL be rejected by the normal authority gate
- **AND** no new revision SHALL be created for the failed restore

#### Scenario: Admin restore is audited

- **WHEN** an admin restores a revision that changes locked fields
- **THEN** the save SHALL be allowed according to admin override rules
- **AND** the resulting revision SHALL record the admin actor and restore message metadata

### Requirement: Restore source metadata

When a revision is restored, the resulting save SHALL include product metadata indicating the source revision sequence so the timeline can display that the new revision was restored from an earlier version.

#### Scenario: Restore message references source sequence

- **WHEN** a maintainer saves content restored from revision `12`
- **THEN** the resulting history entry SHALL allow the UI to display that it was restored from revision `12`
- **AND** the source revision SHALL remain unchanged
