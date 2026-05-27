## ADDED Requirements

### Requirement: Shelf Stores Visible Release Units By Default

For release-aware domains, shelf membership SHALL store the visible release Unit
that the user collected. The shelf system SHALL NOT require adding the hidden
work Unit as a separate invisible shelf item for normal collection behavior.

#### Scenario: User collects release

- **WHEN** a user collects book release `release-a`
- **THEN** `ShelfUnit.unitId` SHALL reference `release-a`
- **AND** the hidden work Unit SHALL NOT be inserted as an additional
  user-visible shelf item

#### Scenario: Concrete release remains visible

- **GIVEN** `ShelfUnit(unitId = release-a)` exists
- **AND** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** the shelf item is rendered in a release-aware context
- **THEN** the UI SHALL still expose that the collected concrete Unit is
  `release-a`

### Requirement: Shelves Register Work-Domain Membership

The system SHALL register shelf Units in work domains when they contain releases
that belong to those work domains. The shelf Unit SHALL be registered with
`UnitWork(role = SHELF)`. This is the generic Unit-based work-domain membership
path, not a shelf-specific work projection field.

#### Scenario: Shelf containing release enters work domain

- **GIVEN** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** shelf `shelf-s` contains `release-a`
- **THEN** `UnitWork(shelf-s, work-x, role = SHELF)` SHALL exist
- **AND** work-domain surfaces for `work-x` MAY list `shelf-s` as related
  content

#### Scenario: Shelf can belong to multiple work domains

- **GIVEN** shelf `shelf-s` contains `release-a` from `work-a`
- **AND** it contains `release-b` from `work-b`
- **WHEN** work-domain membership is reconciled
- **THEN** `UnitWork(shelf-s, work-a, role = SHELF)` SHALL exist
- **AND** `UnitWork(shelf-s, work-b, role = SHELF)` SHALL exist

### Requirement: Shelf Work Membership Is Reconciled From Contained Releases

Shelf work-domain membership SHALL be maintained from the shelf's contained
release Units. Add/remove operations and release move/merge repair SHALL
recalculate affected shelf memberships rather than blindly deleting a work
membership that may still be justified by another contained release.

#### Scenario: Removing one same-work release keeps membership

- **GIVEN** shelf `shelf-s` contains `release-a` and `release-b`
- **AND** both releases belong to `work-x`
- **WHEN** `release-a` is removed from `shelf-s`
- **THEN** `UnitWork(shelf-s, work-x, role = SHELF)` SHALL remain because
  `release-b` still justifies it

#### Scenario: Removing final same-work release removes membership

- **GIVEN** shelf `shelf-s` contains only one release from `work-x`
- **WHEN** that release is removed from `shelf-s`
- **THEN** reconciliation SHALL remove `UnitWork(shelf-s, work-x, role = SHELF)`
  unless another explicit work-domain rule justifies the membership

### Requirement: Work-Domain Shelf Cards Show Precise Release Context

When a shelf appears inside a release page's work-domain surface, the card SHALL
show which contained releases caused the shelf to belong to the current work
when that context is relevant. If those releases differ from the current
release, the card SHALL render their release-identifying metadata.

#### Scenario: Shelf card shows sibling release context

- **GIVEN** current page release is `release-b`
- **AND** shelf `shelf-s` belongs to the current work because it contains
  `release-a`
- **WHEN** `shelf-s` renders in the work-domain shelf section
- **THEN** the card SHALL show identifying metadata for `release-a`
- **AND** it SHALL NOT imply that `shelf-s` contains `release-b`

### Requirement: Shelf Grouping Follows Canonical Work After Merge

Shelf storage SHALL remain release-first during work merge. Work merge SHALL NOT
rewrite raw shelf membership rows unless a separate explicit shelf operation
requires it. Shelf work-domain membership SHALL resolve merged source works to
the target canonical work after merge repair.

#### Scenario: Shelf belongs to target work after merge

- **GIVEN** a shelf contains release `release-a`
- **AND** `release-a` belonged to source work `work-old`
- **AND** `work-old` has been merged into `work-new`
- **WHEN** shelf work-domain repair completes
- **THEN** `UnitWork(shelf, work-new, role = SHELF)` SHALL exist
- **AND** stale membership justified only by `work-old` SHALL be removed
- **AND** the raw shelf row SHALL continue to reference `release-a`
