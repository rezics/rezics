## Requirements

### Requirement: ReplyComposer is the single reply-editor component

The app SHALL expose exactly one reply-editor component, `ReplyComposer`, from `package/app/src/post/forms/`. Every surface that accepts a reply — the focal-post composer on every detail page, inline composers inside thread rows, and the shelf discussion composer — SHALL render `ReplyComposer`. The existing `InlinePostForm` component SHALL be replaced and removed.

#### Scenario: InlinePostForm is removed
- **WHEN** the change is complete
- **THEN** `InlinePostForm.tsx` SHALL no longer exist
- **AND** `rg "InlinePostForm"` under `package/app/` SHALL return zero matches

#### Scenario: Every reply surface uses ReplyComposer
- **WHEN** a developer lists the JSX occurrences of reply-composition UI across detail pages, thread rows, and the new shelf discussion section
- **THEN** every one SHALL be `<ReplyComposer />`

### Requirement: ReplyComposer mode prop selects start state

`ReplyComposer` SHALL accept a required `mode` prop with two values:

- `"progressive"`: renders a single-line, low-height placeholder that looks like an input field with placeholder text (localised, content-type-aware). Focusing the field SHALL expand it into the full editor region (toolbar, multi-line body area, Cancel / Post buttons).
- `"expanded"`: renders the full editor region immediately on mount (toolbar, body area, Cancel / Post buttons, body focused).

`ReplyComposer` SHALL NOT expose any prop named `variant`, `collapsed`, or `initialOpen` — `mode` is the single axis of control.

#### Scenario: Progressive mode collapsed on mount
- **WHEN** a `<ReplyComposer mode="progressive" />` mounts
- **THEN** the rendered element is a single-line placeholder control, approximately the height of a `TextField` of MUI `size="small"`
- **AND** no toolbar or action buttons are visible

#### Scenario: Progressive mode expands on focus
- **WHEN** the user focuses the progressive composer
- **THEN** the control expands to the full editor region
- **AND** the body input retains focus

#### Scenario: Expanded mode renders full editor on mount
- **WHEN** a `<ReplyComposer mode="expanded" />` mounts
- **THEN** the full editor region is visible immediately
- **AND** the body input is focused

### Requirement: Blur-retain rule

When any `ReplyComposer` (regardless of mode) loses focus — for example the user clicks elsewhere — the composer SHALL apply the following rule:

- If the body field is empty (whitespace-only counts as empty), the composer SHALL collapse. For `mode="progressive"` this means returning to the single-line placeholder. For `mode="expanded"` this means unmounting the editor (the composer disappears from the DOM).
- If the body has any non-whitespace content, the composer SHALL remain in its current expanded state until the user explicitly cancels or submits.

#### Scenario: Empty progressive composer collapses on blur
- **WHEN** the user focuses a progressive composer, types nothing, and then clicks elsewhere
- **THEN** the composer collapses back to the single-line placeholder

#### Scenario: Non-empty progressive composer stays expanded on blur
- **WHEN** the user focuses a progressive composer, types "hello", and then clicks elsewhere
- **THEN** the composer remains expanded with the text preserved
- **AND** the user can click back into it without losing their draft

#### Scenario: Empty expanded composer unmounts on blur
- **WHEN** a user opens a thread-row inline composer (`mode="expanded"`), types nothing, then clicks elsewhere
- **THEN** the composer unmounts
- **AND** the row beneath it returns to its previous state

#### Scenario: Non-empty expanded composer stays mounted on blur
- **WHEN** a user opens a thread-row inline composer, types "ok", then clicks elsewhere in the thread
- **THEN** the composer stays mounted with the draft preserved

### Requirement: Multiple expanded composers coexist independently

Multiple `<ReplyComposer mode="expanded" />` instances MAY be mounted simultaneously inside the same thread (one per row whose "Reply" button was clicked). Each instance's draft state and focus lifecycle SHALL be independent of the others. The blur-retain rule applies to each independently — opening a second composer SHALL NOT auto-collapse or cancel the first.

#### Scenario: Two independent composers remain open concurrently
- **WHEN** a user clicks "Reply" on thread row A, types "thinking…", then clicks "Reply" on thread row B
- **THEN** both composers are visible
- **AND** row A's draft "thinking…" is intact
- **AND** row B's composer is freshly mounted with focus

#### Scenario: Submitting one composer does not affect the other
- **WHEN** the user submits row B's composer successfully
- **THEN** row B's composer unmounts (or resets per success behaviour)
- **AND** row A's composer remains open with its draft preserved

### Requirement: Reply button click semantics per surface

Clicking the `"reply"` action on a `ReactionBar` SHALL produce one of three behaviours depending on the surface:

1. **List card** (any content type's card in a list): the handler SHALL navigate to the content's detail page with a query parameter `?focus=reply`.
2. **Focal post on a detail page**: the handler SHALL focus the top `ReplyComposer` (whose mode is `"progressive"`). If the composer is currently collapsed, focusing SHALL trigger its expansion via the progressive-focus behaviour.
3. **Non-focal row inside a thread** (any depth): the handler SHALL inline-mount a new `<ReplyComposer mode="expanded" />` as a child of that row. The composer is visually attached to the row and sits above / before any existing child replies in the tree rendering.

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
- **AND** no navigation occurs
- **AND** no modal opens

### Requirement: Focus-reply query param handler

Every detail page that hosts a focal `ReplyComposer` SHALL implement a `useFocusReplyFromQuery()` hook (or equivalent) that reads the `?focus=reply` search parameter on mount and, when present, focuses the top progressive composer. The hook SHALL clear the parameter from the URL after focusing so a page refresh does not refocus.

#### Scenario: Landing on a detail URL with focus=reply auto-focuses
- **WHEN** a user navigates to `/review/:reviewId?focus=reply`
- **THEN** the top `ReplyComposer` receives focus on mount
- **AND** the URL is rewritten to `/review/:reviewId` (the param removed) without an extra navigation entry in history

#### Scenario: No focus param produces no auto-focus
- **WHEN** a user navigates to `/review/:reviewId`
- **THEN** the top `ReplyComposer` remains in its default collapsed state
- **AND** keyboard focus is not hijacked

### Requirement: Reply drawer and reply modal removal

The existing reply-drawer patterns used on `BookDiscussionPage` (`ReplyDrawer` or similar) and any scratch reply-modal implementations SHALL be removed. Replies SHALL always be composed via `ReplyComposer` inline, following the per-surface click semantics above.

#### Scenario: No reply drawer or modal remains in the tree
- **WHEN** a developer runs `rg "ReplyDrawer|ReplyModal|reply-drawer|reply-modal"` under `package/app/`
- **THEN** no matches SHALL be returned after this change
