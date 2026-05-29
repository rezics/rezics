## ADDED Requirements

### Requirement: The question tag carries an open/solved/closed-reason state schema

The official question tag SHALL be a stateful tag whose schema defines initial
state `open` and values `open` (active), `solved` (closed), `not-planned`
(closed), `duplicate` (closed), and `off-topic` (closed). A post made into a Q&A
thread by bearing the official question tag SHALL have its `state` initialized to
`open` and `extra.stateSchemaTag` set to the question tag slug. There SHALL be no
bare `closed` value; concluding a question sets a specific closed-bucket value.

#### Scenario: Question thread starts open

- **WHEN** a root post is created bearing the official question tag
- **THEN** its `state` SHALL be `open`
- **AND** `extra.stateSchemaTag` SHALL be the question tag slug

#### Scenario: Closing a question requires a reason

- **GIVEN** an open question
- **WHEN** it is closed without being solved
- **THEN** its `state` SHALL be set to `not-planned`, `duplicate`, or `off-topic`
- **AND** the schema SHALL NOT offer a bare `closed` value

### Requirement: Accepting an answer maintains the solved state cache

The `ACCEPTED_ANSWER` `PostPin` SHALL remain the source of truth for whether a
question is solved; `state = solved` SHALL be a maintained cache of that fact.
Accepting an answer SHALL set `state` from `open` to `solved`. Unaccepting the
last accepted answer SHALL set `state` from `solved` back to `open`. If the
question's `state` has been manually set to a closed reason (`not-planned`,
`duplicate`, or `off-topic`), accept/unaccept SHALL NOT overwrite it (the pin is
still recorded).

#### Scenario: Accepting an answer marks the question solved

- **GIVEN** a question thread with `state = open`
- **WHEN** an authorized actor accepts a direct reply as an answer
- **THEN** an `ACCEPTED_ANSWER` pin SHALL be recorded
- **AND** the question's `state` SHALL become `solved`

#### Scenario: Unaccepting the last answer reopens the question

- **GIVEN** a question thread with `state = solved` and exactly one accepted
  answer
- **WHEN** that answer is unaccepted
- **THEN** the question's `state` SHALL become `open`

#### Scenario: Manual closed reason is not overwritten by accept/unaccept

- **GIVEN** a question thread whose `state` was manually set to a closed reason
  (e.g. `duplicate`)
- **WHEN** an answer is accepted or unaccepted
- **THEN** the `ACCEPTED_ANSWER` pin SHALL be recorded or removed accordingly
- **AND** the question's `state` SHALL remain the manual closed reason

#### Scenario: Unsolved questions filter off the active bucket

- **WHEN** unsolved questions are listed
- **THEN** the query SHALL filter on `state` (the `active` bucket, i.e.
  `state = open`) rather than performing an anti-join against `PostPin`
</content>
