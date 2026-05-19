## MODIFIED Requirements

### Requirement: Realm management page for owner and admin

The route `/realm/:realmId/manage` SHALL render a management page accessible
only to users with owner or admin role in the realm, **or users with global
admin/root role**. The page SHALL allow editing realm metadata
(name/description through UnitTranslation, public/private metadata where
available), managing member roles, and deleting the realm (owner or global
admin/root only).

Realm title and description editing SHALL support all UnitTranslation languages
on the realm. The selected language SHALL render as a Select control with an
adjacent add-language action. Saving SHALL upsert the selected language's
UnitTranslation row.

#### Scenario: Owner accesses management page

- **WHEN** a realm owner navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL display realm metadata editing controls, member role
  management, and a realm deletion option

#### Scenario: Admin accesses management page

- **WHEN** a realm admin navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL display realm metadata editing controls and member
  role management
- **AND** the realm deletion option SHALL NOT be visible

#### Scenario: Global admin accesses management page of any realm

- **WHEN** a global admin navigates to `/realm/:realmId/manage` for a realm they
  do not own
- **THEN** the page SHALL display realm metadata editing controls, member role
  management, and the realm deletion option

#### Scenario: Translation update uses correct API

- **WHEN** a user edits the realm title or description on the manage page and
  saves
- **THEN** the system SHALL call the unit translation upsert endpoint (not embed
  translations in the realm update payload)

#### Scenario: Realm manager selects translation language

- **GIVEN** a realm has UnitTranslation rows for `["en", "zh-hant"]`
- **WHEN** a manager opens `/realm/:realmId/manage`
- **THEN** the current language SHALL be rendered with a Select control
- **AND** selecting `"zh-hant"` SHALL load that translation's title and
  description into the form

#### Scenario: Realm manager adds translation language

- **GIVEN** a realm has only an English UnitTranslation
- **WHEN** a manager adds `"ja"` from the language control
- **THEN** the form SHALL switch to `"ja"`
- **AND** saving SHALL create or update the realm's Japanese UnitTranslation
