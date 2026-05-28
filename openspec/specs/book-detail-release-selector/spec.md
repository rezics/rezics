# book-detail-release-selector Specification

## Purpose

Defines the release selector that sits above the Content tab's chapter
tree and the Releases tab that lists same-work releases. The selector
sorts releases by current language first with the translation-designated
(official) release pinned within each language group, auto-selects the
official release for the resolved language while preserving manual
overrides until the language changes, and exposes language-filtered
same-work releases ordered by `UnitWork.position`. Hidden-by-default
releases stay reachable but never dominate default selectors.

## Requirements

### Requirement: Content tab displays a release selector above the chapter tree

The Content tab SHALL render a dropdown selector above the chapter tree that lists all releases under the book's parent work. Selecting a release SHALL load that release's content structure via `bookQueries.contentStructure(releaseUnitId)`.

#### Scenario: Release selector is visible

- **WHEN** the Content tab is active
- **THEN** a release selector dropdown SHALL be rendered above the chapter tree

#### Scenario: Selecting a release loads its content structure

- **WHEN** the user selects a different release from the dropdown
- **THEN** the chapter tree SHALL reload with the selected release's content structure

### Requirement: Releases are sorted with current language first and official releases pinned

The release selector SHALL sort releases in the following order: (1) releases matching the currently selected language appear first, (2) within each language group, the translation-designated (official) release appears first, (3) non-official releases in the same language follow, (4) other language groups follow the same pattern. The official release for each language is identified by matching the release's `unitId` against the book's `translations[].unitId`.

#### Scenario: Current language releases appear first

- **GIVEN** the selected language is `"ja"`
- **AND** the work has releases: `[{unitId: "r1", lang: "ja"}, {unitId: "r2", lang: "ja"}, {unitId: "r3", lang: "en"}]`
- **AND** `translations` designates `r1` as official for `"ja"` and `r3` as official for `"en"`
- **WHEN** the release selector is opened
- **THEN** releases SHALL appear in order: `r1` (ja, official), `r2` (ja), `r3` (en, official)

#### Scenario: Official release is pinned within language group

- **GIVEN** the selected language is `"ja"`
- **AND** releases `r1` (ja, non-official) and `r2` (ja, official) exist
- **WHEN** the release selector is opened
- **THEN** `r2` SHALL appear before `r1` within the Japanese group

### Requirement: Default release follows the selected language's translation-designated unit

When the book detail page loads or the language selection changes, the release selector SHALL auto-select the official release for the current language. The official release is the one whose `unitId` matches `book.translations.find(tr => tr.language === selectedLang).unitId`. If no translation exists for the selected language, the selector SHALL retain its current selection.

#### Scenario: Initial load selects official release for resolved language

- **GIVEN** the resolved language is `"ja"` and `translations[ja].unitId = "release-ja-1"`
- **WHEN** the Content tab loads
- **THEN** the release selector SHALL default to `"release-ja-1"`

#### Scenario: Language switch updates default release

- **GIVEN** the current release is `"release-ja-1"` (official for `"ja"`)
- **WHEN** the user switches language to `"en"` (official release: `"release-en-1"`)
- **THEN** the release selector SHALL auto-switch to `"release-en-1"`

#### Scenario: Manual override is preserved within same language

- **GIVEN** the user manually selected `"release-ja-2"` (non-official, `"ja"`)
- **AND** the language remains `"ja"`
- **WHEN** no language change occurs
- **THEN** the release selector SHALL retain `"release-ja-2"`

#### Scenario: Manual override is reset on language change

- **GIVEN** the user manually selected `"release-ja-2"` (non-official, `"ja"`)
- **WHEN** the user switches language to `"en"`
- **THEN** the release selector SHALL auto-switch to the official `"en"` release

### Requirement: Releases Tab Lists Same-Work Releases

The book detail page SHALL provide a Releases tab that lists visible
`UnitWork(role = RELEASE)` members from the current release's work domain. It
SHALL expose release role, language, `position`, and display policy where
available.

#### Scenario: Releases tab lists same-work releases

- **GIVEN** current release `release-a` belongs to `work-x`
- **WHEN** the Releases tab opens
- **THEN** it SHALL list visible `UnitWork(role = RELEASE)` members of `work-x`
- **AND** it SHALL NOT list releases from unrelated works

#### Scenario: Releases are ordered by fractional position

- **GIVEN** `release-a` and `release-b` are same-work releases
- **AND** their `UnitWork.position` values define `release-b` before
  `release-a`
- **WHEN** the Releases tab renders matching releases
- **THEN** `release-b` SHALL appear before `release-a`
- **AND** ordering SHALL NOT use a numeric `rank` field

### Requirement: Releases Tab Supports Multi-Select Language Filtering

The Releases tab SHALL provide language filtering for same-work releases. The
filter SHALL support multiple selected languages, SHALL default to the viewer's
preferred languages when available, and SHALL include an All option that clears
language filtering.

#### Scenario: Preferred languages selected by default

- **GIVEN** the viewer prefers `zh-hant` and `ja`
- **WHEN** the Releases tab opens from a book detail page
- **THEN** `zh-hant` and `ja` SHALL be selected in the language filter by
  default
- **AND** releases in other languages SHALL be hidden until the filter changes

#### Scenario: All shows every same-work release

- **WHEN** the user selects All in the Releases tab language filter
- **THEN** the tab SHALL show all visible same-work releases regardless of
  language
- **AND** the results SHALL still be ordered by `UnitWork.position`

### Requirement: Secondary Releases Are Available But Not Dominant

Secondary and hidden-by-default releases SHALL remain reachable for precise
reading/review needs, but hidden-by-default releases SHALL NOT dominate default
selectors or search surfaces.

#### Scenario: Hidden-by-default release is tucked away

- **GIVEN** `UnitWork(release-rare, work-x, role = RELEASE)` has
  `displayPolicy = HIDDEN_BY_DEFAULT`
- **WHEN** the default Releases tab renders
- **THEN** `release-rare` SHALL be hidden behind an expansion affordance or
  advanced filter
- **AND** direct links to `release-rare` SHALL still resolve

### Requirement: Work Context Shows Release List And Tags

The system SHALL show release and tag context on surfaces that ask a user to
confirm or inspect a work domain. These surfaces include the
Releases tab and creation-time work matching panels, SHALL show existing
releases under the work and the work tag list or inherited tag summary. The work
context label SHALL be derived from release context rather than requiring a
separate public work title.

#### Scenario: Work context panel gives enough disambiguation

- **GIVEN** current work `work-x` has multiple releases and work-level tags
- **WHEN** the Releases tab or creation matching panel displays `work-x`
- **THEN** it SHALL show same-work releases
- **AND** it SHALL show work-level tags or inherited tag summary
- **AND** it SHALL not depend on a standalone public work title to disambiguate
  the work
