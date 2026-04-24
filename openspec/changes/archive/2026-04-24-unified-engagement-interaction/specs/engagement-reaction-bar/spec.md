## ADDED Requirements

### Requirement: Single ReactionBar component for every interaction footer

The app SHALL expose exactly one interaction-footer component, `ReactionBar`, from `package/app/src/engagement/`. Every card, reply row, and detail-page focal component SHALL render this component in place of any bespoke reaction/reply footer. No feature folder (`post/`, `review/`, `remark/`, `excerpt/`, `shelf/`) SHALL define its own local footer component. Existing footer implementations (`PostReactionFooter`, `MiniActionBar`, `ReactionStatistics`) SHALL be deleted once migration is complete.

#### Scenario: Feature folder does not define a local footer
- **WHEN** a developer inspects `package/app/src/post/components/parts/`, `package/app/src/review/components/`, `package/app/src/remark/components/`, `package/app/src/excerpt/components/`, or `package/app/src/shelf/components/`
- **THEN** no file matching `*Footer.tsx`, `*ReactionBar.tsx`, or `*ActionBar.tsx` SHALL exist that duplicates `ReactionBar`'s responsibilities

#### Scenario: Legacy footers are removed
- **WHEN** the change is complete
- **THEN** `package/app/src/post/components/parts/PostReactionFooter.tsx`, `package/app/src/engagement/components/MiniActionBar.tsx`, and `package/app/src/engagement/components/ReactionStatistics.tsx` SHALL no longer exist
- **AND** `rg "PostReactionFooter|MiniActionBar|ReactionStatistics"` SHALL return zero matches under `package/app/`

### Requirement: Size and actions are orthogonal props

`ReactionBar` SHALL accept exactly two structural props:

- `size`: one of `"sm"` | `"md"` | `"lg"`. Controls visual density (icon size, padding, font-size of counts, whether text labels render alongside icons).
- `actions`: an ordered array of action tokens drawn from `"vote" | "reply" | "share" | "shelf" | "more" | "funny" | "award"`. The array determines which action atoms render and in which order. Tokens not listed do not render.

`ReactionBar` SHALL NOT accept a `variant` prop or any prop that bundles `size` and `actions` together. Per-content-type defaults SHALL live in policy helpers (per Requirement: Per-content-type action policy), not inside `ReactionBar`.

#### Scenario: Size and actions vary independently
- **WHEN** a caller renders `<ReactionBar size="sm" actions={["vote", "reply"]} />`
- **THEN** only the vote pill and reply action render, sized for dense thread-row use
- **AND** swapping the same call to `size="lg"` SHALL produce the same two actions rendered at detail-page density

#### Scenario: Unknown action tokens are ignored silently
- **WHEN** a caller includes a reserved token (`"funny"` or `"award"`) in `actions`
- **THEN** `ReactionBar` SHALL NOT render UI for it in this change
- **AND** other tokens in the same array SHALL render normally

#### Scenario: No variant prop exists
- **WHEN** a developer inspects the `ReactionBar` props type
- **THEN** there SHALL be no `variant`, `context`, or `surface` prop

### Requirement: Vote pill is number-only, Reddit-style

The vote action token SHALL render a pill-shaped `VoteGroup` atom containing an up-arrow icon, the net score as a number, and a down-arrow icon, in that order (horizontal orientation at `size="sm"` and `size="md"`). No text label such as "upvote", "downvote", or "vote" SHALL accompany the arrows. The current user's vote state SHALL be reflected by colouring the selected arrow (up-arrow coloured when upvoted, down-arrow coloured when downvoted). The score SHALL format large numbers with the "3.1K" convention (thousands abbreviated above 1000, one decimal place).

#### Scenario: Vote pill renders arrows and a number only
- **WHEN** a `VoteGroup` atom renders for a post with score 123 and no user vote
- **THEN** the atom renders ⬆, the text "123", and ⬇ in a horizontal pill
- **AND** no accompanying text label ("upvote" / "vote" / etc.) appears

#### Scenario: User's vote is visually reflected
- **WHEN** the current user has upvoted the post
- **THEN** the up-arrow icon SHALL render in the brand highlight colour
- **AND** the down-arrow SHALL render in the neutral/muted colour

#### Scenario: Large score abbreviation
- **WHEN** the post's net score is 3127
- **THEN** the atom SHALL display "3.1K"

### Requirement: Non-vote actions render icon plus text label

Action tokens other than `"vote"` SHALL render as an icon paired with a text label. The labels SHALL be localised via `i18n` and SHALL be:

- `"reply"` → 💬 + `"Reply"` (or localised equivalent). When the prop `replyCount` is provided and greater than zero, the count SHALL render in place of "Reply" on non-focal card surfaces (e.g. `💬 30`), and as "Reply" only in contexts where the count is redundant (e.g. inside an already-expanded thread where each row shows its own count).
- `"share"` → ↗ + `"Share"`.
- `"shelf"` → 📚 + `"Shelf"` (or localised "Save").
- `"more"` → ⋯ (no label; the icon is universally understood).

Actions SHALL NOT render as icon-only unless explicitly flagged by `size="sm"` where space is constrained, in which case the label collapses to a tooltip.

#### Scenario: Reply action shows count on cards
- **WHEN** a card renders `<ReactionBar actions={["vote", "reply", …]} />` with `replyCount={30}`
- **THEN** the reply action renders as 💬 30

#### Scenario: Reply action shows label on focal surfaces
- **WHEN** a detail page focal component renders `<ReactionBar />` and the reply count is passed but the surface prefers a label
- **THEN** the reply action renders as 💬 Reply (the count is shown elsewhere on the surface, e.g. beneath the body or above the thread)

#### Scenario: Share, Shelf, More always have a visible label on md/lg
- **WHEN** `size="md"` or `size="lg"`
- **THEN** the share, shelf, and more tokens SHALL render with their text labels (more excepted — ⋯ is label-free)

### Requirement: Per-content-type action policy

Each content feature SHALL export an action-policy helper describing which actions to render on each of its surfaces (list card, detail focal, thread row). The policy helper SHALL return an object of the shape:

```ts
type ActionPolicy = {
  actions: Action[];            // in-bar, visible in order
  overflow?: Action[];          // items inside the "⋯ more" menu
};
```

The following defaults SHALL apply:

- **Content-as-artifact types** (review, remark, excerpt, shelf card) on list cards: `actions: ["vote", "reply", "share", "shelf", "more"]`, `overflow: ["report", "copy-link"]`.
- **Content-as-artifact types** on detail page focal: same as list cards but with `"more"` including any additional admin affordances.
- **Post thread root card** on list surfaces: `actions: ["vote", "reply", "share", "more"]`, `overflow: ["shelf", "report", "copy-link"]`. Note that `"shelf"` is demoted to overflow here.
- **Post reply row** (inside a thread): `actions: ["vote", "reply", "share", "more"]`, `overflow: ["shelf", "report", "copy-link"]`. Size is `"sm"`.
- **Post focal** on `/post/:id` detail: `actions: ["vote", "reply", "share", "shelf", "more"]`, `overflow: ["report", "copy-link"]`. Shelf is promoted on detail page.

#### Scenario: A review card promotes shelf to visible
- **WHEN** a `ReviewCard` renders in a list
- **THEN** the `ReactionBar` receives `actions: ["vote", "reply", "share", "shelf", "more"]`
- **AND** the shelf button is visible, not behind the overflow menu

#### Scenario: A post thread root card keeps shelf in overflow
- **WHEN** a thread root post card renders on the book discussion tab
- **THEN** the `ReactionBar` receives `actions: ["vote", "reply", "share", "more"]`
- **AND** opening the overflow menu reveals `"shelf"` and the other overflow actions

#### Scenario: A post detail page promotes shelf to visible
- **WHEN** a user opens `/post/:rootPostUnitId`
- **THEN** the focal post's `ReactionBar` receives `actions: ["vote", "reply", "share", "shelf", "more"]`

### Requirement: Overflow menu is part of ReactionBar

The `"more"` token SHALL render an overflow-menu button that, when clicked, displays a dropdown listing the action-policy's `overflow` entries. The dropdown SHALL use the existing `@rezics/ui` menu primitive. Each overflow entry SHALL render as icon + label and dispatch the same action token as its in-bar counterpart (e.g. selecting `"shelf"` from the overflow opens the same `ShelfPickerModal` that a visible `ShelfAction` would).

#### Scenario: Overflow shelf opens the same modal
- **WHEN** a user opens `[⋯]` on a post thread card and clicks "Shelf"
- **THEN** the `ShelfPickerModal` opens with the post's `unitId` as `targetId`, identically to how an in-bar `ShelfAction` would

#### Scenario: Overflow never duplicates visible actions
- **WHEN** an action policy lists a token in both `actions` and `overflow`
- **THEN** `ReactionBar` SHALL silently deduplicate, preferring the visible placement

### Requirement: VoteGroup owns its own mutation and optimistic state

`VoteGroup` SHALL call `useToggleReaction` internally. Its parent SHALL NOT thread the mutation, optimistic score, or user-vote-state through props. The atom SHALL accept `{ targetUnitId, initialScore, initialUserVote }` as inputs and manage the rest.

#### Scenario: Parent does not receive vote updates through re-render
- **WHEN** a user clicks ⬆ inside a card's `VoteGroup`
- **THEN** the score updates within `VoteGroup` without requiring the containing card to re-render
- **AND** the network mutation is dispatched inside the atom

### Requirement: Card-level click-propagation contract

Every card component (`PostCard`, `ReviewCard`, `RemarkCard`, `ExcerptCard`, `ShelfCard`, and any future card in a list context) SHALL attach a single `onClick` to its outermost container that navigates to the content's detail page. Every interactive leaf inside that card — including `<ReactionBar>`, the author header / avatar region, and any inline `<SafeLink>` — SHALL call `event.stopPropagation()` in its own click handler so the outer navigation does not fire.

`ReactionBar` SHALL itself stop propagation on every click its internal atoms handle. Callers do not need to wrap `ReactionBar` in a `stopPropagation` guard.

#### Scenario: Clicking the card body navigates
- **WHEN** a user clicks on a blank body area of a `ReviewCard`
- **THEN** the application navigates to `/review/:reviewId`

#### Scenario: Clicking an action in the footer does not navigate
- **WHEN** a user clicks the ⬆ arrow inside a card's `ReactionBar`
- **THEN** the vote mutation fires
- **AND** no navigation to the detail page occurs

#### Scenario: Clicking the author avatar does not navigate to the content's detail
- **WHEN** a user clicks on the author's avatar inside a card
- **THEN** the card's outer navigation SHALL NOT fire
- **AND** any avatar-specific behaviour (even if none is wired today) SHALL be free to run

### Requirement: Reserved action tokens

The `Action` token union SHALL include `"funny"` and `"award"` as reserved values. `ReactionBar` SHALL accept these tokens in its `actions` array without type errors. In this change, `ReactionBar` SHALL NOT render any UI for `"funny"` or `"award"`. The tokens exist solely so a future proposal can enable them without breaking or re-keying existing call sites.

#### Scenario: Reserved tokens type-check but do not render
- **WHEN** a caller passes `actions: ["vote", "funny", "award", "reply"]`
- **THEN** the code type-checks
- **AND** only the vote and reply atoms render

#### Scenario: No commented-out "funny" code exists in the bar
- **WHEN** a developer inspects `ReactionBar.tsx`
- **THEN** the file SHALL NOT contain placeholder UI for `"funny"` / `"award"` marked with TODO / FIXME
- **AND** the handling of reserved tokens SHALL be a single `return null` branch
