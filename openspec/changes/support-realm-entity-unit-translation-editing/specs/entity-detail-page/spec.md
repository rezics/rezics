## MODIFIED Requirements

### Requirement: Detail page renders an IMDb-style skeleton with conditional tabs

The detail page SHALL render a Hero region (primary title, kind chip, verified
badge when applicable, Select language switcher when multi-translation, and an
admin edit entry when permitted) and a tab strip beneath it. The tab strip SHALL
include `Overview`, `Works`, `About` as live tabs in v1. The `Awards` and
`News` tab implementations SHALL be written in the same source file but
commented out, including their entry in the tab registration array. Tabs whose
data source returns empty SHALL NOT render in the tablist (no hard-coded
kind->tab mapping).

#### Scenario: Entity with no works hides the Works tab

- **WHEN** the entity has zero attribution rows linking it to any Work-Unit
- **THEN** the `Works` tab SHALL NOT appear in the tablist
- **AND** the default visible tab SHALL fall back to `Overview`

#### Scenario: Entity with multiple translations shows the language switcher

- **WHEN** the entity has UnitTranslation rows in two or more languages
- **THEN** a Select language switcher SHALL render in the Hero region
- **AND** changing the language SHALL re-render translatable text (title,
  summary, description) in the chosen language

#### Scenario: Verified entity displays the verified badge

- **WHEN** the entity has `verified = true`
- **THEN** a `lucide-react` BadgeCheck icon SHALL render next to the kind chip
- **AND** the badge SHALL be present in both the Hero region and EntityPicker
  result rows for the same entity

#### Scenario: Admin sees entity edit entry

- **WHEN** a global admin or root user views an entity detail page
- **THEN** an edit entry SHALL render in the Hero region
- **AND** activating it SHALL navigate to `/entity/:unitId/edit`

#### Scenario: Non-admin does not see entity edit entry

- **WHEN** a non-admin user views an entity detail page
- **THEN** the edit entry SHALL NOT render

## ADDED Requirements

### Requirement: Entity edit page supports UnitTranslation metadata editing

The route `/entity/:unitId/edit` SHALL render an entity edit page for users with
global admin/root permission. The page SHALL allow editing entity fields
(`kind`, `verified`, and `slug` where valid) and UnitTranslation metadata
(`title`, `subtitle`, `summary`, `description`) for the selected language.

The selected UnitTranslation language SHALL render through the shared
Select-based language control, with an adjacent add-language action.

#### Scenario: Admin edits existing entity translation

- **GIVEN** an entity has English and Japanese UnitTranslation rows
- **WHEN** an admin opens `/entity/:unitId/edit`
- **THEN** the page SHALL show a Select for the active language
- **AND** choosing Japanese SHALL load the Japanese title/subtitle/summary/
  description into the form
- **AND** saving SHALL persist the Japanese UnitTranslation fields

#### Scenario: Admin adds entity translation language

- **GIVEN** an entity has only an English UnitTranslation
- **WHEN** an admin adds `"zh-hant"` from the language control
- **THEN** the form SHALL switch to `"zh-hant"`
- **AND** saving SHALL create or update the Traditional Chinese UnitTranslation

#### Scenario: Non-admin cannot access entity edit page

- **WHEN** a non-admin user navigates to `/entity/:unitId/edit`
- **THEN** the page SHALL redirect or otherwise deny access without rendering
  the edit form
