## REMOVED Requirements

### Requirement: Reactions tab placeholder

**Reason**: Replaced by a real Given/Received list view backed by the new `reaction-history` capability.

**Migration**: The `// MOCK:` annotations in `package/app/src/user/sections/ReactionsTabSection.tsx` are removed; the file is rewritten to consume `useGivenReactionsInfinite` / `useReceivedReactionsInfinite`.

### Requirement: Future L2 structure

**Reason**: The "Given" / "Received" chips are no longer placeholders; they are the active filter state of the live tab.

**Migration**: The chips remain in the InnerFilterPanel but with `disabled: false` and a real `onChipChange` handler that toggles the active list.

## ADDED Requirements

### Requirement: Reactions tab renders Given and Received list views

The Reactions tab SHALL provide two list views, switchable via the existing InnerFilterPanel chips:

- **Given**: events placed by the profile owner. Backed by `GET /profile/:userId/reactions/given`.
- **Received**: events placed by others on the profile owner's units. Backed by `GET /profile/:userId/reactions/received`.

The default chip on tab open SHALL be "Given". Switching chips SHALL reset scroll position and start the alternate list at its first page.

#### Scenario: Default view is Given
- **WHEN** a user navigates to the Reactions tab on a profile
- **THEN** the "Given" chip is active and the Given list renders

#### Scenario: Switching to Received
- **WHEN** the user clicks the "Received" chip
- **THEN** the active list switches to Received
- **AND** the previous list's scroll position is reset

#### Scenario: Empty Given
- **WHEN** the profile owner has placed no reactions
- **THEN** the Given list renders an empty-state message

#### Scenario: Empty Received
- **WHEN** no other user has reacted to the profile owner's units
- **THEN** the Received list renders an empty-state message

### Requirement: Lists use cursor-paginated infinite scroll

Each list SHALL fetch pages of up to 20 rows via `useGivenReactionsInfinite` or `useReceivedReactionsInfinite`. As the user scrolls near the end of the loaded data, the next page SHALL fetch automatically. The end-of-list state SHALL be visible (e.g. "No more reactions") when `nextCursor` is `null`.

#### Scenario: Auto-fetch next page
- **WHEN** the user scrolls within a configurable threshold of the bottom of the loaded list
- **THEN** the next page query fires automatically and rows append
- **AND** scroll position is preserved across the append

#### Scenario: End-of-list signal
- **WHEN** the most recent response has `nextCursor: null`
- **THEN** an end-of-list indicator renders below the last row

### Requirement: Each row renders via a shared ReactionHistoryItem component

Each row SHALL render via `ReactionHistoryItem` with a `mode: "given" | "received"` prop. The row SHALL display:

- **Always**: the reaction icon/emoji, a relative timestamp, the target's title or snippet, and a `<SafeLink>` to the target's detail page.
- **When `mode = "received"`**: the actor's avatar and display name, with a `<SafeLink>` to the actor's profile.

When `target` is `null` (deleted unit), the row SHALL render with a "[deleted content]" placeholder in place of the target snippet, no link, and otherwise the same metadata.

#### Scenario: Given row renders target
- **WHEN** a Given row renders for a `like` reaction on a post titled "Hello"
- **THEN** the row shows the like icon, the post title, a timestamp, and links to the post detail page

#### Scenario: Received row renders actor and target
- **WHEN** a Received row renders for actor "alice" who liked the profile owner's review
- **THEN** the row shows alice's avatar + display name, a like icon, the review snippet, a timestamp, and links

#### Scenario: Deleted target
- **WHEN** a row's `target` field is `null`
- **THEN** the row renders with a "[deleted content]" placeholder, no target link, and the rest of the row remains intact

### Requirement: Tab respects profile visibility

If the main-server endpoint returns 403 (private profile, unauthorized viewer), the tab SHALL render a "private profile" message rather than a list shell. If the endpoint returns a transient error, the tab SHALL show an error state with a retry control.

#### Scenario: Private profile blocks the tab
- **WHEN** the viewer cannot access the requested profile and the endpoint returns 403
- **THEN** the tab renders a "this profile is private" message

#### Scenario: Transient error
- **WHEN** the endpoint returns a 5xx error
- **THEN** the tab renders a retry control that re-fires the active list query

### Requirement: No MOCK annotations remain

All `// MOCK:` annotations previously in `ReactionsTabSection.tsx` SHALL be removed. The placeholder text "Reaction history is coming soon" SHALL no longer appear.

#### Scenario: Source contains no mock markers
- **WHEN** a developer inspects `package/app/src/user/sections/ReactionsTabSection.tsx`
- **THEN** `rg "// MOCK:" package/app/src/user/sections/ReactionsTabSection.tsx` returns zero matches
- **AND** the string "Reaction history is coming soon" is not present
