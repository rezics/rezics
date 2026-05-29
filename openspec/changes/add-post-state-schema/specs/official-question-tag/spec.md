## ADDED Requirements

### Requirement: The question tag carries an open/answered/closed state schema

The official question tag SHALL be a stateful tag whose schema defines states
`open`, `answered`, and `closed` with initial state `open`. A post made into a
Q&A thread by bearing the official question tag SHALL have its `state`
initialized to `open` and `extra.stateSchemaTag` set to the question tag slug.

#### Scenario: Question thread starts open

- **WHEN** a root post is created bearing the official question tag
- **THEN** its `state` SHALL be `open`
- **AND** `extra.stateSchemaTag` SHALL be the question tag slug

### Requirement: Accepting an answer maintains the answered state cache

The `ACCEPTED_ANSWER` `PostPin` SHALL remain the source of truth for whether a
question is answered; `state = answered` SHALL be a maintained cache of that
fact. Accepting an answer SHALL set `state` from `open` to `answered`.
Unaccepting the last accepted answer SHALL set `state` from `answered` back to
`open`. If the question's `state` has been manually set to `closed`,
accept/unaccept SHALL NOT overwrite it (the pin is still recorded).

#### Scenario: Accepting an answer marks the question answered

- **GIVEN** a question thread with `state = open`
- **WHEN** an authorized actor accepts a direct reply as an answer
- **THEN** an `ACCEPTED_ANSWER` pin SHALL be recorded
- **AND** the question's `state` SHALL become `answered`

#### Scenario: Unaccepting the last answer reopens the question

- **GIVEN** a question thread with `state = answered` and exactly one accepted
  answer
- **WHEN** that answer is unaccepted
- **THEN** the question's `state` SHALL become `open`

#### Scenario: Manual closed is not overwritten by accept/unaccept

- **GIVEN** a question thread whose `state` was manually set to `closed`
- **WHEN** an answer is accepted or unaccepted
- **THEN** the `ACCEPTED_ANSWER` pin SHALL be recorded or removed accordingly
- **AND** the question's `state` SHALL remain `closed`

#### Scenario: Unanswered questions filter off state

- **WHEN** unanswered questions are listed
- **THEN** the query SHALL filter on `state` (e.g. `state = open`) rather than
  performing an anti-join against `PostPin`
