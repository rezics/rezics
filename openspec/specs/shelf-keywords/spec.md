## ADDED Requirements

### Requirement: ShelfItem keywords for personal annotation

Each ShelfItem SHALL support a `keywords` field of type `String[]` (default empty). Keywords are user-defined personal labels for organizing items within a shelf.

#### Scenario: Add keywords when collecting a unit

- **WHEN** a user collects a unit with keywords `["to-read", "summer"]`
- **THEN** the ShelfItem SHALL be created with `keywords: ["to-read", "summer"]`

#### Scenario: Update keywords on an existing shelf item

- **WHEN** a user updates the keywords on a ShelfItem from `["to-read"]` to `["reading", "favorite"]`
- **THEN** the ShelfItem's keywords SHALL be replaced with `["reading", "favorite"]`

#### Scenario: Same unit in two shelves has independent keywords

- **WHEN** a unit is in Shelf A with keywords `["urgent"]` and Shelf B with keywords `["reference"]`
- **THEN** modifying the keywords on the ShelfItem in Shelf A SHALL NOT affect the keywords on the ShelfItem in Shelf B

### Requirement: User-level keyword vocabulary for autocomplete

The User model SHALL have a `keywords` field of type `String[]` (default empty) that stores the user's complete keyword vocabulary. This list SHALL power keyword autocomplete suggestions in the collection modal.

#### Scenario: New keywords auto-appended to user vocabulary

- **WHEN** a user adds keyword "gift-idea" to a ShelfItem and "gift-idea" is not in their User.keywords
- **THEN** "gift-idea" SHALL be appended to User.keywords

#### Scenario: Existing keyword not duplicated

- **WHEN** a user adds keyword "to-read" to a ShelfItem and "to-read" is already in their User.keywords
- **THEN** User.keywords SHALL remain unchanged (no duplicate appended)

#### Scenario: Autocomplete returns user's keyword vocabulary

- **WHEN** a user requests their keyword list for autocomplete
- **THEN** the system SHALL return the complete User.keywords array

### Requirement: Keyword management API

Users SHALL be able to add and remove keywords from their vocabulary independently of shelf item operations.

#### Scenario: Add keywords to vocabulary

- **WHEN** a user adds keywords `["work", "personal"]` to their vocabulary
- **THEN** "work" and "personal" SHALL be appended to User.keywords (if not already present)

#### Scenario: Remove keyword from vocabulary

- **WHEN** a user removes keyword "old-tag" from their vocabulary
- **THEN** "old-tag" SHALL be removed from User.keywords
- **AND** existing ShelfItems that have "old-tag" in their keywords SHALL NOT be affected (keyword removal from vocabulary does not cascade to items)

### Requirement: Filter shelf items by keyword

Shelf item listings SHALL support filtering by keyword.

#### Scenario: Filter items by a single keyword

- **WHEN** a user queries shelf items with `keyword=summer`
- **THEN** only ShelfItems whose `keywords` array contains "summer" SHALL be returned

### Requirement: User keyword vocabulary limit

The User.keywords array SHALL have a service-layer limit to prevent unbounded growth.

#### Scenario: Adding keyword beyond limit

- **WHEN** a user's keyword vocabulary has reached the limit (e.g., 500 keywords)
- **AND** the user attempts to add a new keyword
- **THEN** the system SHALL reject the addition with an appropriate error message
- **AND** User.keywords SHALL remain unchanged
