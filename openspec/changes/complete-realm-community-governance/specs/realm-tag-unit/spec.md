## MODIFIED Requirements

### Requirement: Realm tag curation is governed and audited

Realm tag association creation, removal, and score-sensitive curation SHALL require realm policy authorization and SHALL write realm event/audit records.

#### Scenario: Moderator removes misleading tag

- **WHEN** a moderator removes a realm tag association
- **THEN** the action SHALL be policy-authorized
- **AND** a realm governance event SHALL record actor, target, tag, and reason when provided

### Requirement: Realm tag tab supports configurable navigation styles

Realm tag browsing SHALL support `flat`, `grouped`, and `tree` display styles. New realms SHALL default to `flat`; realm owners/admins MAY choose a default style during creation or in management settings. Viewers MAY switch styles when the realm permits viewer style switching.

#### Scenario: New realm defaults to flat tags

- **WHEN** a realm is created without an explicit tag display style
- **THEN** the realm tag tab SHALL default to the flat style

#### Scenario: Grouped tag tab renders category panels

- **GIVEN** a realm tag tree has group nodes with child tag nodes
- **AND** the realm default tag style is `grouped`
- **WHEN** a user opens the Tags tab
- **THEN** the UI SHALL render group/category panels with their child tags
- **AND** selecting a child tag SHALL filter by the underlying tag Unit id

### Requirement: Realm tag tree structure is semantic and multilingual

`Realm.extra.tagTree` SHALL represent navigation structure only; classification and filtering SHALL continue to use tag Unit ids. Tag node labels SHALL resolve from Tag Unit `UnitTranslation`. Group/category node labels SHALL be multilingual through a referenced Unit or an explicitly modeled translation map; raw single-language labels SHALL NOT be the long-term contract.

#### Scenario: Tag labels resolve through UnitTranslation

- **GIVEN** a tag tree node references tag Unit `T`
- **AND** `T` has English and Traditional Chinese UnitTranslation rows
- **WHEN** a Traditional Chinese viewer opens the Tags tab
- **THEN** the tag label SHALL resolve from the Traditional Chinese UnitTranslation when available
- **AND** it SHALL use the standard fallback chain when unavailable

### Requirement: Tree style supports arbitrary depth

The tree tag display style SHALL support arbitrary nested group/category nodes while preserving tag selection semantics as a set of tag Unit ids.

#### Scenario: Deep group expands to tag children

- **GIVEN** a realm tag tree contains three nested group levels and several tag leaves
- **WHEN** a user expands the tree and selects a leaf tag
- **THEN** the feed/search filter SHALL receive that leaf tag Unit id
- **AND** parent group nodes SHALL NOT be submitted as classification filters unless they are also explicit tag nodes
