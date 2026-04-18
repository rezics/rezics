## MODIFIED Requirements

### Requirement: sourceReleaseUnitId links work translations to their source release

The `sourceReleaseUnitId` field on `UnitTranslation` is optional and SHALL only be meaningful for **work unit translations in the work/release model** (BOOK, GAME, MEDIA). When set, it indicates which release unit provides the content for that language, enabling navigation from a work's translation to the release that supplies it.

`sourceReleaseUnitId` SHALL NOT be used by POST or any other Unit type outside the work/release model. Parallel POST translations are linked via the separate `TranslationGroup` mechanism defined in the `post-parallel-translation` capability; the two mechanisms are mutually exclusive per Unit.

#### Scenario: Work translation with sourceReleaseUnitId

- GIVEN a work Unit "work-1" with a release Unit "release-en" providing English content
- WHEN the UnitTranslation for `(unitId = "work-1", language = "en")` is created with `sourceReleaseUnitId = "release-en"`
- THEN a client reading the work's English translation can follow `sourceReleaseUnitId` to navigate to the release unit "release-en"

#### Scenario: Release unit translation has no sourceReleaseUnitId

- GIVEN a release Unit "release-en"
- WHEN inspecting its UnitTranslation records
- THEN `sourceReleaseUnitId` SHALL be null because releases are themselves the content source

#### Scenario: Standalone non-POST unit has no sourceReleaseUnitId

- GIVEN a standalone Unit (neither work nor release) of type other than POST
- WHEN inspecting its UnitTranslation records
- THEN `sourceReleaseUnitId` SHALL be null

#### Scenario: POST unit never uses sourceReleaseUnitId

- GIVEN a Unit of type `POST`, whether standalone or participating in a `TranslationGroup`
- WHEN inspecting its `UnitTranslation` records
- THEN `sourceReleaseUnitId` SHALL be null on every row
- AND the system SHALL NOT treat `sourceReleaseUnitId` as a navigation hint for POST translations
