# library-content-metadata Specification

## Purpose

Defines derived USWN (Universal Standard Work Number) metadata on library content DTOs. `metadata.uswn` is a server-derived field equal to the merge-resolved canonical work Unit id, never stored as a column, and frontend surfaces render it directly rather than computing it client-side.

## Requirements

### Requirement: Library DTOs Expose Derived USWN Metadata

The system SHALL expose derived USWN metadata on library content DTOs. Library
content DTOs, including book DTOs and future release-aware library
content DTOs, SHALL expose `metadata.uswn` as a derived field. USWN stands for
Universal Standard Work Number. In this change, the value SHALL be the
merge-resolved canonical work Unit id. The field SHALL NOT be stored as a
database column or as a separate backend identity record.

When a Unit has no work domain, `metadata.uswn` SHALL be `null`.

#### Scenario: Release DTO exposes current canonical work id

- **GIVEN** release `release-a` belongs to work `work-x`
- **WHEN** a library content DTO for `release-a` is returned
- **THEN** `metadata.uswn` SHALL equal `work-x`

#### Scenario: Standalone DTO exposes null USWN

- **GIVEN** Unit `unit-y` has no active work domain
- **WHEN** a library content DTO for `unit-y` is returned
- **THEN** `metadata.uswn` SHALL be `null`

#### Scenario: Merged work resolves to target

- **GIVEN** release `release-a` previously belonged to source work `work-old`
- **AND** `work-old` has been merged into target work `work-new`
- **WHEN** a library content DTO for `release-a` is returned after canonical
  merge resolution
- **THEN** `metadata.uswn` SHALL equal `work-new`
- **AND** the frontend SHALL NOT need to resolve work merges client-side

### Requirement: USWN Is Rendered From Metadata

Frontend library surfaces that display the standard work identifier SHALL render
the value from `metadata.uswn`. They SHALL NOT compute USWN by inspecting release
membership, search grouping ids, or merge records client-side.

#### Scenario: Frontend renders server-derived USWN

- **WHEN** a book detail or metadata panel receives a DTO with
  `metadata.uswn = "work-x"`
- **THEN** the UI SHALL render `work-x` as the USWN value where the design calls
  for the standard work identifier
- **AND** if `metadata.uswn` is `null`, the UI SHALL render the corresponding
  empty/none state rather than inventing a fallback id
