# entity-detail-page Specification

## Purpose

Defines the public detail page for an Entity unit. A single React component backs two route paths — `/e/:slug` (canonical, slug-resolving) and `/entity/:unitId` (id-direct fallback) — and renders an IMDb-style Hero plus conditional tab strip (`Overview`, `Works`, `About` in v1, with `Awards` and `News` scaffolded but commented out). Empty tabs hide themselves rather than relying on hard-coded kind→tab maps. Owner labels and subscribe affordances are deliberately deferred (see `content-creation-mode` and `engagement-subscription`).

## Requirements

### Requirement: Single shared component renders /e/:slug and /entity/:unitId

The entity detail page SHALL be implemented as a single React component reused by two route paths: `/e/:slug` (slug route) and `/entity/:unitId` (id route). The slug route SHALL first resolve the slug to a unitId via the `entity` typed-slug endpoint (cached through SlugRef), then delegate to the shared component using the resolved unitId. The id route SHALL render the shared component directly.

#### Scenario: /e/:slug resolves and renders

- **WHEN** a viewer navigates to `/e/liu-cixin`
- **AND** that slug exists in the entity scope
- **THEN** the slug SHALL be resolved to its unitId
- **AND** the shared detail component SHALL render with that unitId

#### Scenario: /entity/:unitId renders directly

- **WHEN** a viewer navigates to `/entity/01h8e5g6t...` (UUID)
- **AND** an ENTITY-typed Unit with that id exists
- **THEN** the shared detail component SHALL render with that unitId
- **AND** no slug-resolution step SHALL be performed

#### Scenario: Unknown slug returns 404

- **WHEN** a viewer navigates to `/e/does-not-exist`
- **THEN** the route SHALL return a 404 not-found state without falling back to the unitId route or other scopes

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
- **AND** the badge SHALL be present in both the Hero region and EntityPicker result rows for the same entity

#### Scenario: Admin sees entity edit entry

- **WHEN** a global admin or root user views an entity detail page
- **THEN** an edit entry SHALL render in the Hero region
- **AND** activating it SHALL navigate to `/entity/:unitId/edit`

#### Scenario: Non-admin does not see entity edit entry

- **WHEN** a non-admin user views an entity detail page
- **THEN** the edit entry SHALL NOT render

### Requirement: Overview tab renders entity bio

The `Overview` tab SHALL render the entity's `UnitTranslation.summary` and `UnitTranslation.description` in the current display language. If neither field has content in the current language, the tab SHALL render a neutral empty-state ("No overview available") and SHALL NOT fall back to another language silently.

#### Scenario: Overview shows bio in current language

- **WHEN** the entity has `summary = "中国科幻作家"` in zh and `summary = "Chinese SF author"` in en
- **AND** the current display language is zh
- **THEN** the Overview tab SHALL display "中国科幻作家"

#### Scenario: Overview empty state in current language

- **WHEN** the entity has translations only in zh and the current display language is en
- **THEN** the Overview tab SHALL display the neutral empty state without falling back to zh content

### Requirement: Detail page omits owner label in v1

The detail page SHALL NOT render an owner card, byline, or "created by" label in v1. The OwnerHint conditional branch (neutral "Community catalog entry" label for system-owned entities; no label for user-owned) SHALL be deferred until `content-creation-mode` lands. The render area reserved for this label SHALL remain absent from the DOM, not hidden with CSS, so introducing the label later is purely additive.

#### Scenario: Detail page renders without owner card

- **WHEN** the entity detail page renders for any v1 entity
- **THEN** no owner card, byline, or creator label SHALL appear in the page DOM

### Requirement: Detail page omits subscribe button in v1

The detail page SHALL NOT render a Subscribe / Follow button in v1. The button is deferred until `engagement-subscription` lands. The render area reserved for the button SHALL remain absent from the DOM.

#### Scenario: Detail page renders without subscribe button

- **WHEN** the entity detail page renders for any v1 entity
- **THEN** no subscribe or follow button SHALL appear in the page DOM

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
