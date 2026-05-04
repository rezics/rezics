## ADDED Requirements

### Requirement: ReplyComposer accepts realmUnitIds and tagIds for top-level realm posts

`ReplyComposer` SHALL accept two additional optional props beyond its existing `mode`, `targetUnitId`, and `parentPostUnitId`:

- `realmUnitIds?: string[]` — when non-empty, the composer enters "top-level realm post" mode. The composer surfaces a tag picker hydrated from the realm's `extra.tagTree` (when exactly one realm id is supplied) or shows search-only (when multiple). On submission, the create-post call passes `realmUnitIds` so the server writes corresponding `RealmUnit` rows.
- `tagIds?: string[]` — initial tag selection passed through to the picker. After mount the picker controls its own selection state; this prop seeds initial state.

Reply mode (`targetUnitId` and/or `parentPostUnitId` set) and realm-post mode (`realmUnitIds` set) SHALL be mutually exclusive. The component types SHALL enforce this with a TypeScript discriminated union, and the runtime SHALL assert the invariant.

#### Scenario: Composer in realm-post mode does not require reply target

- **WHEN** a developer renders `<ReplyComposer mode="expanded" realmUnitIds={["realm-1"]} />`
- **THEN** the composer SHALL render without `targetUnitId` or `parentPostUnitId`
- **AND** the body input SHALL be focused
- **AND** a tag picker SHALL be visible above or beside the action buttons

#### Scenario: Mixing reply props with realmUnitIds is a type error

- **WHEN** a developer attempts `<ReplyComposer realmUnitIds={["r1"]} targetUnitId="post-x" />`
- **THEN** TypeScript compilation SHALL fail
- **AND** the runtime SHALL also assert and reject this combination at mount time

#### Scenario: Submission carries realmUnitIds and tagIds

- **GIVEN** `<ReplyComposer realmUnitIds={["realm-1"]} />` with body "Welcome"
- **AND** the user has selected `tag-intro` in the picker
- **WHEN** the user clicks Post
- **THEN** the createPost call SHALL include `{ body: "Welcome", realmUnitIds: ["realm-1"], tagIds: ["tag-intro"] }`
- **AND** SHALL NOT include `targetUnitId` or `parentPostUnitId`

## MODIFIED Requirements

### Requirement: Reply button click semantics per surface

Clicking the `"reply"` action on a `ReactionBar` SHALL produce one of three behaviours depending on the surface:

1. **List card** (any content type's card in a list): the handler SHALL navigate to the content's detail page with a query parameter `?focus=reply`.
2. **Focal post on a detail page**: the handler SHALL focus the top `ReplyComposer` (whose mode is `"progressive"`). If the composer is currently collapsed, focusing SHALL trigger its expansion via the progressive-focus behaviour.
3. **Non-focal row inside a thread** (any depth): the handler SHALL inline-mount a new `<ReplyComposer mode="expanded" />` as a child of that row. The composer is visually attached to the row and sits above / before any existing child replies in the tree rendering.

Reply-button surfaces SHALL ONLY use ReplyComposer in reply mode (with `targetUnitId` and/or `parentPostUnitId`). They SHALL NOT pass `realmUnitIds` — realm-post-mode mounts come from the realm-page entry point defined in the `realm-forum-composer` capability, not from reply buttons.

#### Scenario: Clicking reply on a list card navigates and focuses

- **WHEN** a user clicks "Reply" on a `ReviewCard` on `/book/:bookId/review`
- **THEN** the app navigates to `/review/:reviewId?focus=reply`
- **AND** after the detail page mounts, the top progressive composer is focused and expanded

#### Scenario: Clicking reply on the focal post focuses the top composer

- **WHEN** a user on `/remark/:remarkId` clicks "Reply" inside the focal remark's `ReactionBar`
- **THEN** the top progressive composer receives focus and expands
- **AND** no second composer mounts

#### Scenario: Clicking reply on a thread row mounts an inline expanded composer

- **WHEN** a user on `/post/:rootId` clicks "Reply" inside a reply row at depth 3
- **THEN** a new `<ReplyComposer mode="expanded" />` mounts as a child of that row
- **AND** the mounted composer is in reply mode (no `realmUnitIds` set)
- **AND** no navigation occurs
- **AND** no modal opens
