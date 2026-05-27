## ADDED Requirements

### Requirement: Release-Aware Review And Remark Pages Match Preview Scope

Release-aware review and remark list pages SHALL use the same default scope as
the preview surfaces that link to them.

When a release-aware book page links from a work-domain review or remark
preview to a full list page, the full list page SHALL use the same work-domain
scope by default. Exact-release list mode SHALL remain available when the page
or route explicitly requests it.

#### Scenario: Review preview opens matching full list

- **GIVEN** a book detail page preview lists reviews through `workUnitId = work-x`
- **WHEN** the user opens the full reviews page from that preview
- **THEN** the full reviews page SHALL query reviews through `workUnitId = work-x`
- **AND** it SHALL not shrink to only `targetUnitId = currentRelease`

#### Scenario: Remark full list for release with work

- **GIVEN** the current release belongs to work `work-x`
- **WHEN** the user opens the full remarks page for the book route
- **THEN** the page SHALL query remarks through work-domain membership by default

### Requirement: Exact-Release Labels Are Localized

Release scope controls SHALL use localized labels.

Any review, remark, shelf, or scoped-search UI that exposes a release scope
toggle SHALL use localized labels for all-releases and this-release modes.

#### Scenario: Scope toggle labels

- **WHEN** a release-aware list page renders a scope toggle
- **THEN** the labels SHALL be resolved through the app i18n message catalog
- **AND** raw work Unit ids SHALL NOT be shown as user-facing labels
