## ADDED Requirements

### Requirement: Game platform and worldview entity kinds

The contract entity kind registry SHALL include `game_platform` and `universe`.

`game_platform` SHALL identify reusable platform subjects (for example Windows,
Steam, Steam Deck, PlayStation 5, Nintendo Switch) attached to GAME releases
through the `available_on` subject role.

`universe` SHALL identify a shared fictional universe / worldview attached to any
work through the `setting` subject role, including standalone works that are not
members of any Series. `universe` intentionally names the same concept as the
Series `universe` kind at a different structural layer: the Series kind is a
curated, release-first collection, while the Entity kind is a taggable subject.

External official age/content ratings SHALL NOT be an entity kind; they are
modeled as catalog tags.

#### Scenario: Create a platform Entity

- **WHEN** an Entity is created with `kind = "game_platform"` and `game_platform` is registered
- **THEN** the Entity record SHALL be persisted with `kind = "game_platform"`

#### Scenario: Create a worldview Entity

- **WHEN** an Entity is created with `kind = "universe"`
- **THEN** the Entity record SHALL be persisted with `kind = "universe"`
- **AND** it MAY be attached to works through the `setting` subject role

#### Scenario: Age rating is not an entity kind

- **WHEN** a caller attempts to create an Entity with `kind = "age_rating"`
- **THEN** the request SHALL be rejected because `age_rating` is not a registered entity kind
- **AND** external age ratings SHALL be modeled as catalog tags instead
