## ADDED Requirements

### Requirement: Game and media parts use content structure

Game and media parts that need identity SHALL be represented as Units and
organized through content structure nodes. This includes DLC, expansions,
episodes, seasons, volumes, specials, bonus content, soundtrack entries, and
similar concrete content parts.

The node identity field SHALL remain `contentUnitId`; `targetUnitId` SHALL
remain reserved for interactions such as reviews, posts, ratings, and comments.

#### Scenario: Game DLC is a content Unit

- **WHEN** a game release includes a DLC entry that needs its own title or metadata
- **THEN** the DLC SHALL be represented as a Unit
- **AND** the game release content structure SHALL include a node pointing at that Unit through `contentUnitId`

#### Scenario: Media episode is a content Unit

- **WHEN** a media release includes an episode that users can discuss or track
- **THEN** the episode SHALL be represented as a Unit
- **AND** the media release content structure SHALL include a node pointing at that Unit through `contentUnitId`

#### Scenario: Interaction targets still use targetUnitId

- **WHEN** a user reviews a DLC Unit or media episode Unit
- **THEN** the review write SHALL use `targetUnitId` for the reviewed Unit
- **AND** the release content structure SHALL continue to use `contentUnitId` for node identity

### Requirement: Summary counts are not canonical content structure

Summary count fields SHALL NOT be canonical content structure. Episode count,
season count, DLC count, volume count, and similar summary fields SHALL NOT be
treated as canonical structure. Canonical part identity and ordering SHALL come
from content structure when the parts are modeled.

#### Scenario: Episode list reads content structure

- **WHEN** a client renders a media release's episode list
- **THEN** it SHALL read content-structure nodes
- **AND** it SHALL NOT construct episode identities from `episodeCount`
