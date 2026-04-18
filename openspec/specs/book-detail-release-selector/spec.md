## ADDED Requirements

### Requirement: Content tab displays a release selector above the chapter tree

The Content tab SHALL render a dropdown selector above the chapter tree that lists all releases under the book's parent work. Selecting a release SHALL load that release's chapter index via `bookQueries.chapterIndex(releaseUnitId)`.

#### Scenario: Release selector is visible

- **WHEN** the Content tab is active
- **THEN** a release selector dropdown SHALL be rendered above the chapter tree

#### Scenario: Selecting a release loads its chapter index

- **WHEN** the user selects a different release from the dropdown
- **THEN** the chapter tree SHALL reload with the selected release's chapter index

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
