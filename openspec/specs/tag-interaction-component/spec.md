## ADDED Requirements

### Requirement: Tag chips are clickable and support three interaction states

The tag interaction component SHALL manage three states: **idle** (no selection, no popper), **single-preview** (one tag's detail popper is open), and **multi-select** (two or more tags selected, search bar visible). State transitions SHALL follow the defined state machine.

#### Scenario: Initial state is idle

- **WHEN** the tag interaction component mounts
- **THEN** all tag chips SHALL render in their default (unselected) style
- **AND** no popper or search bar SHALL be visible

#### Scenario: Single click opens popper (idle → single-preview)

- **GIVEN** the component is in idle state
- **WHEN** the user clicks a tag chip
- **THEN** a Popper SHALL open anchored to the clicked chip with an arrow pointing to it
- **AND** the component SHALL enter single-preview state

#### Scenario: Click same chip closes popper (single-preview → idle)

- **GIVEN** a popper is open for tag A
- **WHEN** the user clicks tag A again
- **THEN** the popper SHALL close
- **AND** the component SHALL return to idle state

#### Scenario: Click close button closes popper (single-preview → idle)

- **GIVEN** a popper is open for tag A
- **WHEN** the user clicks the close (✕) button in the popper
- **THEN** the popper SHALL close
- **AND** the component SHALL return to idle state

#### Scenario: Click different chip enters multi-select (single-preview → multi-select)

- **GIVEN** a popper is open for tag A
- **WHEN** the user clicks tag B (B ≠ A)
- **THEN** the popper SHALL close
- **AND** both tag A and tag B SHALL become selected (visually highlighted)
- **AND** a search action bar SHALL appear
- **AND** the component SHALL enter multi-select state

#### Scenario: Toggle chips in multi-select

- **GIVEN** the component is in multi-select state with tags A and B selected
- **WHEN** the user clicks tag C
- **THEN** tag C SHALL become selected
- **AND** the search bar SHALL update to show 3 selected tags

#### Scenario: Deselect in multi-select

- **GIVEN** the component is in multi-select state with tags A and B selected
- **WHEN** the user clicks tag A
- **THEN** tag A SHALL become deselected

#### Scenario: Deselect all returns to idle (multi-select → idle)

- **GIVEN** the component is in multi-select state with only tag A selected
- **WHEN** the user clicks tag A (deselects it)
- **THEN** the search action bar SHALL disappear
- **AND** the component SHALL return to idle state

### Requirement: Popper displays tag detail with description, score, voting, and search

The single-preview popper SHALL display: (1) the tag's translated name, (2) the tag's translated description (if available), (3) the tag's score and vote count, (4) upvote and downvote buttons that call the existing `castTagVote` API, (5) a "Search this tag" button that navigates to the search page with the tag injected.

#### Scenario: Popper renders tag detail

- **WHEN** a popper opens for a tag with name "異世界", description "主角被傳送到另一個世界...", score 142, voteCount 89
- **THEN** the popper SHALL display the name, description, score, vote count, vote buttons, and search button

#### Scenario: Upvote from popper

- **GIVEN** a popper is open for tag "tag-1" on unit "book-1"
- **WHEN** the user clicks the upvote button
- **THEN** a `castTagVote({ tagUnitId: "tag-1", unitId: "book-1", value: 1 })` request SHALL be sent

#### Scenario: Search from popper navigates with injection

- **GIVEN** a popper is open for tag with slug "isekai", unitId "tag-1", name "異世界"
- **WHEN** the user clicks "Search this tag"
- **THEN** the browser SHALL navigate to `/search?q=[isekai]`
- **AND** router state SHALL include `injectedTags: [{ slug: "isekai", unitId: "tag-1", name: "異世界" }]`

### Requirement: Popper is non-modal and does not block chip interaction

The popper SHALL use MUI `Popper` (not `Popover`). It SHALL NOT render a backdrop, lock scroll, or trap focus. Other tag chips SHALL remain clickable while the popper is open.

#### Scenario: Click another chip while popper is open

- **GIVEN** a popper is open for tag A
- **WHEN** the user clicks tag B
- **THEN** the click SHALL be received by tag B's click handler (not blocked by the popper)

### Requirement: Multi-select search bar shows count and navigates with injection

When in multi-select state, a search action bar SHALL appear below (or above) the tag chips. It SHALL display the number of selected tags and a "Search selected tags" button. Clicking the button SHALL navigate to the search page with all selected tags' `[slug]` syntax in the URL and full tag objects in router state.

#### Scenario: Multi-select search navigation

- **GIVEN** tags "isekai" (unitId: "tag-1", name: "異世界") and "adventure" (unitId: "tag-2", name: "冒險") are selected
- **WHEN** the user clicks "Search selected tags"
- **THEN** the browser SHALL navigate to `/search?q=[isekai][adventure]`
- **AND** router state SHALL include both tag objects in `injectedTags`

#### Scenario: Search bar updates count

- **GIVEN** 2 tags are selected and the search bar shows "2 tags selected"
- **WHEN** the user selects a third tag
- **THEN** the search bar SHALL update to "3 tags selected"
## Requirements
### Requirement: Popper is non-modal and does not block chip interaction

The popper SHALL use a non-modal popover primitive — shadcn `Popover` (from `@rezics/ui/shadcn`, Radix-based) configured with `modal={false}`. It SHALL NOT render a backdrop, lock scroll, or trap focus. Other tag chips SHALL remain clickable while the popper is open. The component SHALL NOT import from `@mui/material` (no `MUI Popper`, `MUI Popover`, or related primitive).

#### Scenario: Click another chip while popper is open

- **GIVEN** a popper is open for tag A
- **WHEN** the user clicks tag B
- **THEN** the click SHALL be received by tag B's click handler (not blocked by the popper)
- **AND** the popper for tag A SHALL close (driven by the `onOpenChange` of the Radix popover)
- **AND** the popper for tag B SHALL open

#### Scenario: No backdrop and no scroll lock

- **WHEN** a tag-interaction popper is open
- **THEN** the page SHALL remain scrollable and other elements SHALL remain clickable
- **AND** there SHALL be no element with `pointer-events: auto` covering the page beneath the popper

#### Scenario: No MUI imports in tag interaction

- **WHEN** the tag-interaction component file is inspected
- **THEN** there SHALL be no import from `@mui/material`
- **AND** the popover SHALL be sourced from `@rezics/ui/shadcn`

