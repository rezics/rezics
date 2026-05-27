## ADDED Requirements

### Requirement: Realm management console lives in package/app

The realm owner/admin/moderator console SHALL live under realm product routes in `package/app`, not under `package/admin`.

#### Scenario: Moderator opens realm queue

- **WHEN** a moderator opens `/r/:realmSlug/manage/moderation`
- **THEN** the page SHALL show the realm moderation queue for that realm
- **AND** it SHALL NOT navigate to the admin app

### Requirement: Console covers operational realm tasks

The console SHALL include sections for overview, rules, members, moderation queue, pinned/announcement content, tag curation, settings, and ownership transfer/deletion where allowed.

#### Scenario: Owner edits rules

- **WHEN** a realm owner updates rules in the console
- **THEN** the server SHALL persist versioned realm rules
- **AND** members SHALL be prompted to acknowledge material rule changes when required

### Requirement: Console follows Rezics app design density

Realm management UI SHALL use product-side Rezics design-system rhythm and `@rezics/ui` primitives. It SHALL not mimic the compact operator density of `package/admin`.

#### Scenario: Management page renders states

- **WHEN** queue data is loading, empty, denied, or failed
- **THEN** the page SHALL render accessible state content using shared UI primitives and Traditional Chinese copy where localized
