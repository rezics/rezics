## MODIFIED Requirements

### Requirement: Slug is type-gated to TAG, REALM, and ZONE

Only units with type `TAG`, `REALM`, or `ZONE` SHALL be permitted to have a slug set. Attempts to set a slug on any other unit type (BOOK, GAME, MEDIA, POST, SHELF, CHAPTER, IMAGE, VIDEO, QUOTE, LINK) SHALL be rejected with a validation error.

#### Scenario: Setting slug on a TAG unit

- **WHEN** a user sets slug `"sci-fi"` on a unit with type `TAG`
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a REALM unit

- **WHEN** a user sets slug `"book-club"` on a unit with type `REALM`
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a ZONE unit

- **WHEN** a user sets slug `"featured-this-week"` on a unit with type `ZONE`
- **THEN** the slug SHALL be saved successfully

#### Scenario: Setting slug on a BOOK unit is rejected

- **WHEN** a user attempts to set a slug on a unit with type `BOOK`
- **THEN** the request SHALL be rejected with a validation error indicating slugs are not supported for this unit type

#### Scenario: Setting slug on a SHELF unit is rejected

- **WHEN** a user attempts to set a slug on a unit with type `SHELF`
- **THEN** the request SHALL be rejected with a validation error indicating slugs are not supported for this unit type
