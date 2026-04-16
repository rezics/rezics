### Requirement: Unit slug field

The `Unit` model SHALL have an optional `slug` field of type `String?` with a unique index. The slug serves as a globally unique, human-readable identifier alongside the UUIDv7 primary key.

#### Scenario: Unit with slug is addressable by slug

- **WHEN** a unit has slug `"science-fiction"`
- **THEN** querying by `slug = "science-fiction"` SHALL return that unit
- **AND** no other unit in the system SHALL have the same slug value

#### Scenario: Unit without slug remains addressable by ID

- **WHEN** a unit has no slug set (null)
- **THEN** the unit SHALL still be addressable by its UUIDv7 `id`
- **AND** the null slug SHALL NOT conflict with other null slugs

### Requirement: Slug is type-gated to TAG and REALM

Only units with type `TAG` or `REALM` SHALL be permitted to have a slug set. Attempts to set a slug on any other unit type (BOOK, GAME, MEDIA, POST, SHELF, CHAPTER, IMAGE, VIDEO, QUOTE, LINK) SHALL be rejected with a validation error.

#### Scenario: Setting slug on a TAG unit

- **WHEN** a user sets slug `"sci-fi"` on a unit with type `TAG`
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a REALM unit

- **WHEN** a user sets slug `"book-club"` on a unit with type `REALM`
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a BOOK unit is rejected

- **WHEN** a user attempts to set a slug on a unit with type `BOOK`
- **THEN** the request SHALL be rejected with a validation error indicating slugs are not supported for this unit type

### Requirement: Slug is write-once for non-admin users

Once a slug has been set on a unit, non-admin users SHALL NOT be able to modify or remove it. Only users with the global administrator role SHALL be permitted to update or clear a unit's slug.

#### Scenario: Owner sets slug for the first time

- **WHEN** the owner of a TAG unit with `slug = null` submits slug `"fantasy"`
- **THEN** the slug SHALL be set to `"fantasy"`

#### Scenario: Owner attempts to change existing slug

- **WHEN** the owner of a TAG unit with `slug = "fantasy"` submits slug `"fantasy-genre"`
- **THEN** the request SHALL be rejected with a forbidden error indicating the slug cannot be changed
- **AND** the slug SHALL remain `"fantasy"`

#### Scenario: Global admin modifies an existing slug

- **WHEN** a global administrator updates a unit's slug from `"fantasy"` to `"fantasy-genre"`
- **THEN** the slug SHALL be updated to `"fantasy-genre"`
- **AND** all validation rules (format, uniqueness, reserved words) SHALL still apply

#### Scenario: Global admin clears a slug

- **WHEN** a global administrator sets a unit's slug to null
- **THEN** the slug SHALL be cleared
- **AND** the unit SHALL revert to being addressable only by ID

### Requirement: Slug can be set at creation or later

The slug MAY be provided when creating a TAG or REALM unit, or it MAY be set in a subsequent update. Both paths SHALL apply the same validation rules.

#### Scenario: Slug provided at creation

- **WHEN** a user creates a new TAG unit with slug `"mystery"`
- **THEN** the unit SHALL be created with slug `"mystery"`

#### Scenario: Slug added after creation

- **WHEN** a user updates a TAG unit that has `slug = null` to set slug `"mystery"`
- **THEN** the slug SHALL be set to `"mystery"`

### Requirement: Lookup unit by slug API

The server SHALL expose an API endpoint to look up a unit by its slug. The endpoint SHALL return the unit with its type extension and translations, or a 404 if no unit with that slug exists.

#### Scenario: Lookup existing slug

- **WHEN** a client requests unit by slug `"science-fiction"`
- **AND** a TAG unit with that slug exists
- **THEN** the response SHALL include the unit data with its translations

#### Scenario: Lookup non-existent slug

- **WHEN** a client requests unit by slug `"does-not-exist"`
- **THEN** the response SHALL be a 404 not found error
