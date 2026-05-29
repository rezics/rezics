## ADDED Requirements

### Requirement: Poll display renders from gated results

The poll display (`PollView`) SHALL render from the `PollResultsDTO` returned by
`pollQueries.detail`. A pure-function selector SHALL map the DTO to a render
state — derived from `voteMode`, `resultsVisible`, `closed`, `anonymous`,
`myVote`, and each option's form — without importing React, so it is unit
testable. The display SHALL NOT recompute or infer tallies, visibility, or the
caller's own vote client-side; it renders only what the contract exposes.

#### Scenario: Live results render counts and the caller's selection

- **WHEN** a poll is read with `resultsVisible = true` and `myVote` containing an option id
- **THEN** each option SHALL display its `voteCount` and a proportional bar derived from `totalVotes`
- **AND** the options in `myVote` SHALL be shown as selected

#### Scenario: Selector is React-free and tested

- **WHEN** the render-state selector is exercised in a unit test
- **THEN** it SHALL produce the render state from a `PollResultsDTO` input alone
- **AND** it SHALL NOT import React, hooks, or state modules

### Requirement: Single-choice voting replaces the prior vote

For a poll with `voteMode = SINGLE`, the display SHALL present options as a
mutually-exclusive choice. Selecting an option SHALL cast a vote via the poll
vote mutation; selecting a different option SHALL move the caller's single vote
(a change, not an addition). The UI SHALL reflect the refreshed
`PollResultsDTO` returned by the mutation.

#### Scenario: Changing a single-choice vote

- **GIVEN** a SINGLE poll where the caller's `myVote` is `[A]`
- **WHEN** the caller selects option `B`
- **THEN** the vote mutation SHALL be called with `optionId = B`
- **AND** after the refreshed results, `myVote` SHALL be `[B]` and option `A` SHALL no longer be selected

### Requirement: Multi-choice voting toggles selections

For a poll with `voteMode = MULTI`, the display SHALL present options as
independently toggleable. Selecting an unselected option SHALL cast a vote for
it; selecting an already-selected option SHALL withdraw that option's vote via
the withdraw mutation with the corresponding `optionId`.

#### Scenario: Toggling a multi-choice option off

- **GIVEN** a MULTI poll where the caller's `myVote` is `[A, B]`
- **WHEN** the caller selects the already-selected option `A`
- **THEN** the withdraw mutation SHALL be called with `optionId = A`
- **AND** after the refreshed results, `myVote` SHALL be `[B]`

### Requirement: Withheld tallies are not displayed before close

The display SHALL hide option `voteCount`, `totalVotes`, and result bars while
`resultsVisible` is `false` (an `AFTER_CLOSE` poll before its close). It SHALL
still allow voting (when not closed), SHALL show the caller's own `myVote`, and
SHALL communicate that results are hidden until the poll closes.

#### Scenario: AFTER_CLOSE poll before close hides counts but accepts votes

- **GIVEN** a poll with `resultVisibility = AFTER_CLOSE`, `closed = false`, and `resultsVisible = false`
- **THEN** no option SHALL display a count or result bar
- **AND** a message SHALL indicate results are revealed after the poll closes
- **AND** the caller SHALL still be able to cast or change a vote

### Requirement: Closed polls are read-only

When `closed` is `true`, the display SHALL render results in a read-only mode:
no option SHALL be castable or withdrawable, and the vote controls SHALL be
disabled or absent. The caller's own `myVote` SHALL remain highlighted.

#### Scenario: Voting is disabled on a closed poll

- **GIVEN** a poll with `closed = true`
- **WHEN** the display renders
- **THEN** vote/withdraw controls SHALL be disabled or absent
- **AND** attempting to interact with an option SHALL NOT call any vote mutation

### Requirement: Anonymous polls expose only aggregates and the caller's own vote

When `anonymous` is `true`, the display SHALL render only aggregate tallies and
the caller's own `myVote`. It SHALL NOT render, request, or attempt to derive
any mapping between voters and the options they chose, since the contract never
serializes that mapping for anonymous polls.

#### Scenario: No voter identities shown for an anonymous poll

- **GIVEN** a poll with `anonymous = true`
- **THEN** the display SHALL show aggregate counts (when visible) and the caller's `myVote` only
- **AND** it SHALL NOT show which other users voted for which option

### Requirement: Options render by form, including tombstones

Each option SHALL render according to its dual form: an option with a `label`
SHALL render the text; an option with a `unitId` SHALL render the referenced
unit (via the shared unit card); an option with both `label` and `unitId` null
SHALL render as a tombstoned option (a neutral placeholder) while still showing
its retained `voteCount` when results are visible.

#### Scenario: Unit-reference option renders a unit card

- **WHEN** an option has a `unitId` and no `label`
- **THEN** the option SHALL render the referenced unit using the shared unit card

#### Scenario: Tombstoned option remains visible

- **WHEN** an option has both `label` and `unitId` null but a non-zero `voteCount`
- **THEN** the option SHALL render as a neutral placeholder
- **AND** its `voteCount` SHALL still be shown when results are visible

### Requirement: Standalone poll page composes the poll with its discussion thread

A `Unit(type=POLL)` SHALL have a standalone page that renders the `PollView`
above the poll's discussion thread, where the thread is the existing post-tree
rooted on the poll unit. The poll page SHALL NOT introduce a separate threading
mechanism; replies target the poll unit like replies to any other content unit.

#### Scenario: Poll page shows voting surface and replies

- **WHEN** a viewer opens a poll's standalone page
- **THEN** the poll voting/results surface SHALL render at the top
- **AND** the poll's discussion thread SHALL render below it, rooted on the poll unit

### Requirement: A post may embed a poll referenced via post.extra

The post item SHALL render an embedded poll (reusing the same `PollView`) within
the thread whenever the post carries a poll reference at
`post.extra.poll.unitId`, in addition to the post's own content. The embedded
poll SHALL deep-link to the poll's standalone page. A post without that
reference SHALL render unchanged.

#### Scenario: Post with a poll reference renders an embedded poll

- **GIVEN** a post whose `extra.poll.unitId` is set to an existing poll unit id
- **WHEN** the post renders in a thread
- **THEN** the embedded poll voting/results surface SHALL render for that post
- **AND** it SHALL link to the poll's standalone page

#### Scenario: Post without a poll reference is unchanged

- **GIVEN** a post whose `extra` has no `poll` field
- **WHEN** the post renders
- **THEN** no poll surface SHALL be rendered for that post

### Requirement: Poll authoring composes a valid create-poll input

The poll composer (`PollComposer`) SHALL build a `CreatePollInput`: at least two
options, each option provided as ad-hoc text OR as a unit reference selected via
the shared unit picker, plus the poll settings `voteMode`, `resultVisibility`,
`anonymous`, and an optional `closesAt`. The composer SHALL allow adding,
removing, and reordering options and SHALL prevent submission with fewer than
two options.

#### Scenario: Submitting a poll with two text options

- **WHEN** the author enters two text options and submits
- **THEN** `useCreatePoll` SHALL be called with an `options` array of length two and the chosen settings
- **AND** submission SHALL be blocked while fewer than two options are present

#### Scenario: Adding a unit-reference option

- **WHEN** the author picks an existing unit via the unit picker as an option
- **THEN** that option in the create input SHALL carry `unitId` and SHALL NOT carry `label`

### Requirement: In-thread attach-poll sequences poll then post creation

When an author attaches a poll from the post composer, the client SHALL first
create the poll (`useCreatePoll`) to obtain its `unitId`, then create the post
with `extra.poll.unitId` set to that id. No dedicated server endpoint is
required; the client SHALL sequence the two existing mutations and surface an
error if either fails.

#### Scenario: Attaching a poll to a new post

- **WHEN** an author composes a post with an attached poll and submits
- **THEN** the poll SHALL be created first and its `unitId` captured
- **AND** the post SHALL then be created with `extra.poll.unitId` equal to that id

### Requirement: Poll creation is reachable from the creation surface

Poll SHALL be offered as a guided creation flow: a tile on the unified creation
surface SHALL link to a `/poll/new` route that mounts the `PollComposer`, and a
`Unit(type=POLL)` SHALL resolve to its typed standalone route rather than the
generic unit view.

#### Scenario: Create surface offers a poll tile

- **WHEN** a user views the unified creation surface
- **THEN** a poll creation tile SHALL be present linking to `/poll/new`

### Requirement: Poll UI follows the design system and is localized

All poll UI SHALL use `@rezics/ui` primitives and design tokens per the
`rezics-design` guidance, SHALL provide a Storybook story for each new
component, and SHALL source all user-facing copy from i18n keys (no hardcoded
display strings).

#### Scenario: Components ship stories and localized copy

- **WHEN** a new poll component is added
- **THEN** it SHALL have a Storybook story
- **AND** its user-facing text SHALL come from i18n keys
