## MODIFIED Requirements

### Requirement: VoteGroup owns its own mutation and optimistic state

`VoteGroup` SHALL call `useToggleReaction` (or the equivalent create/delete mutation pair) internally. Its parent SHALL NOT thread the mutation, optimistic score, or user-vote state through props. The atom SHALL accept `{ targetUnitId }` as its only data input and obtain the current score and user vote by calling `useReactionData(targetUnitId)` from `@rezics/api/reaction`. The atom SHALL NOT accept `initialScore` or `initialUserVote` props.

#### Scenario: Parent does not receive vote updates through re-render

- **WHEN** a user clicks ⬆ inside a card's `VoteGroup`
- **THEN** the score updates within `VoteGroup` without requiring the containing card to re-render
- **AND** the network mutation is dispatched inside the atom

#### Scenario: VoteGroup reads from the batch cache

- **WHEN** a section has hydrated reaction data for the bar's `targetUnitId`
- **THEN** `VoteGroup` derives `score` and `userVote` from `useReactionData(targetUnitId)`
- **AND** no `initialScore` / `initialUserVote` props are required at the call site

#### Scenario: VoteGroup renders neutral state before hydration

- **WHEN** `useReactionData(targetUnitId).isHydrated` is `false`
- **THEN** the atom renders 0 (or "—") with both arrows in the muted/neutral colour
- **AND** snaps to real values when the batch resolves, without a flash of incorrect data

### Requirement: Overflow menu is part of ReactionBar

The `"more"` token SHALL render an overflow-menu button via the existing `OverflowMenu` component. When clicked, the menu SHALL display the action-policy's `overflow` entries that are not already visible in the main bar. Each overflow entry SHALL render as icon + label and dispatch the same action token as its in-bar counterpart (e.g. selecting `"shelf"` from the overflow opens the same `ShelfPickerModal` that a visible `ShelfAction` would). `ReactionBar.tsx` SHALL NOT contain a `case "more": return null` branch.

#### Scenario: More token actually renders the menu

- **WHEN** an action policy includes `"more"` in `actions` and lists `"shelf"`, `"report"`, `"copy-link"` in `overflow`
- **THEN** the bar renders an `⋯` button followed by an `OverflowMenu` listing the three overflow items
- **AND** clicking `⋯` opens the menu

#### Scenario: Overflow shelf opens the same modal

- **WHEN** a user opens `[⋯]` on a post thread card and clicks "Shelf"
- **THEN** the `ShelfPickerModal` opens with the post's `unitId` as `targetId`, identically to how an in-bar `ShelfAction` would

#### Scenario: Overflow never duplicates visible actions

- **WHEN** an action policy lists a token in both `actions` and `overflow`
- **THEN** `ReactionBar` SHALL silently deduplicate, preferring the visible placement

#### Scenario: ReactionBar source no longer contains a return-null more branch

- **WHEN** a developer inspects `package/app/src/engagement/components/ReactionBar.tsx`
- **THEN** there SHALL NOT be a `case "more": return null` line in the action switch
- **AND** the file SHALL render `<OverflowMenu>` for the `more` token

### Requirement: Single ReactionBar component for every interaction footer

The app SHALL expose exactly one interaction-footer component, `ReactionBar`, from `package/app/src/engagement/`. Every card, reply row, and detail-page focal component SHALL render this component in place of any bespoke reaction/reply footer. No feature folder (`post/`, `review/`, `remark/`, `excerpt/`, `shelf/`) SHALL define its own local footer component. Existing footer implementations (`PostReactionFooter`, `MiniActionBar`, `ReactionStatistics`) SHALL be deleted once migration is complete.

`ReactionBar` SHALL NOT accept `reactionSummaries` or `userReactions` as input props. The bar derives those values internally via `useReactionData(post.unitId)`. Callers SHALL pass `post.unitId` (and the action policy and any presentation overrides) but SHALL NOT pass reaction state through the component tree.

#### Scenario: Feature folder does not define a local footer

- **WHEN** a developer inspects `package/app/src/post/components/parts/`, `package/app/src/review/components/`, `package/app/src/remark/components/`, `package/app/src/excerpt/components/`, or `package/app/src/shelf/components/`
- **THEN** no file matching `*Footer.tsx`, `*ReactionBar.tsx`, or `*ActionBar.tsx` SHALL exist that duplicates `ReactionBar`'s responsibilities

#### Scenario: Legacy footers are removed

- **WHEN** the change is complete
- **THEN** `package/app/src/post/components/parts/PostReactionFooter.tsx`, `package/app/src/engagement/components/MiniActionBar.tsx`, and `package/app/src/engagement/components/ReactionStatistics.tsx` SHALL no longer exist
- **AND** `rg "PostReactionFooter|MiniActionBar|ReactionStatistics"` SHALL return zero matches under `package/app/`

#### Scenario: ReactionBarPost type does not declare reaction-state fields

- **WHEN** a developer inspects the `ReactionBarPost` type
- **THEN** the type SHALL NOT include `reactionSummaries` or `userReactions`
- **AND** callers cannot pass those values through props without a type error
