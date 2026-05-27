## ADDED Requirements

### Requirement: Platform availability and worldview subject roles

The subject attribution role registry SHALL include the `available_on` role for
platform availability, with an Entity kind hint of `game_platform`. The existing
`setting` role SHALL additionally hint the `universe` Entity kind so worldview
subjects can be attached to works.

The registry SHALL NOT include an `age_rating` subject role; external age ratings
are catalog tags, not subjects.

#### Scenario: Platform uses available_on role

- **WHEN** a GAME release is linked to a `game_platform` Entity with `role = "available_on"` and the role is registered
- **THEN** the SubjectAttribution SHALL be persisted with `role = "available_on"`

#### Scenario: Worldview uses setting role

- **WHEN** a work is linked to a `universe` Entity with `role = "setting"`
- **THEN** the SubjectAttribution SHALL be persisted with `role = "setting"`

#### Scenario: Age rating subject role is rejected

- **WHEN** a caller attempts to create a SubjectAttribution with `role = "age_rating"`
- **THEN** the request SHALL be rejected because `age_rating` is not a registered subject role
