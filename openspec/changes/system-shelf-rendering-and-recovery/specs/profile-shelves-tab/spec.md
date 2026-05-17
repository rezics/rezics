## ADDED Requirements

### Requirement: System shelf labels render by viewer role

When the Shelves tab renders cards or tab labels for shelves whose `kindKey` ∈ `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`), the displayed label SHALL be selected according to viewer role:

- **Owner-self view** (the authenticated viewer is the profile owner): the label SHALL be resolved via the application's i18n table keyed on `kindKey` (e.g., `t('shelf.system.favorites')`). The DB-stored shelf title (typically `${slug}'s ${Label}`) SHALL NOT be displayed in this view.
- **Non-owner view** (the viewer is a different user or unauthenticated): the label SHALL be the DB-stored `Unit.translations[viewerLang].title` if present, falling back to the `en` translation (e.g., `alice's Favorites`).

User-created (non-system) shelves SHALL render their DB-stored title regardless of viewer role and SHALL NOT consult the i18n table.

#### Scenario: Owner viewing their own profile sees i18n system shelf labels

- **GIVEN** alice has the four system shelves with DB titles `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`
- **AND** alice's app locale is `zh`
- **WHEN** alice navigates to her own profile's Shelves tab
- **THEN** the four system shelf cards SHALL display the zh i18n results for `shelf.system.favorites`, `shelf.system.backlog`, `shelf.system.active`, and `shelf.system.completed`
- **AND** the literal string `alice's Favorites` (and the three siblings) SHALL NOT appear on the cards

#### Scenario: Non-owner viewing alice's profile sees DB titles

- **GIVEN** alice has the four system shelves with DB titles `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`
- **WHEN** bob navigates to alice's profile's Shelves tab
- **THEN** the visible system shelf cards (subject to shelf visibility filters) SHALL display the DB-stored titles
- **AND** bob's locale-specific i18n keys for `shelf.system.*` SHALL NOT be applied

#### Scenario: User-created shelves render DB title in both views

- **GIVEN** alice has a user-created shelf with DB title `Vintage Sci-Fi`
- **WHEN** alice (owner) or bob (non-owner) navigates to alice's Shelves tab
- **THEN** the shelf card SHALL display `Vintage Sci-Fi`
- **AND** no i18n lookup SHALL apply
