## ADDED Requirements

### Requirement: Realm Feed tab renders pinned posts above the generic feed

The Feed tab on `/realm/:realmId` SHALL render the realm's `pinned` pinboard entries, in order, above the generic realm units feed. Pinned entries SHALL be visually distinguished from generic feed entries (for example a pin icon or subtle background) and SHALL use the viewer's current application language with the platform fallback precedence. When the pinned pinboard is empty, the Feed tab SHALL render the generic feed without any pinned region — there SHALL be no empty placeholder above the feed.

The pinned region SHALL share the same post card presentation used in the generic feed so that activating a pinned entry navigates to the same detail route as a regular entry.

#### Scenario: Pinned posts render above generic feed

- **GIVEN** a realm whose `pinnedPostIds = ["u1", "u2"]` and whose generic feed contains `["u3", "u4", ...]`
- **WHEN** a user opens the Feed tab
- **THEN** entries `u1` and `u2` SHALL appear above `u3`, `u4`, ... in that order
- **AND** each pinned entry SHALL carry a visual pin indicator

#### Scenario: Empty pinboard does not pollute layout

- **WHEN** a user opens the Feed tab for a realm whose `pinned` pinboard is empty
- **THEN** no pinned region or placeholder SHALL be rendered above the generic feed

### Requirement: Realm manage page includes a Pinboard section

The realm manage page at `/realm/:realmId/manage` SHALL include a "Pinboard" section accessible to users with realm role in `{ "owner", "moderator" }` or global role in `{ "ADMIN", "ROOT" }`. The section SHALL render one tab per pinboard key available to the realm. Every realm SHALL see a `Pinned` tab; `default-realm` SHALL additionally see an `Announcement` tab. Each tab SHALL list existing entries in order and SHALL expose controls to create, edit, reorder, pin existing posts, unpin, and soft-delete.

When a user lacks permission, the Pinboard section SHALL NOT be rendered at all (not a disabled state).

#### Scenario: default-realm manage page shows both tabs

- **WHEN** a global admin opens `/realm/<default-realm-id>/manage`
- **THEN** the Pinboard section SHALL show two tabs: `Announcement` and `Pinned`

#### Scenario: Regular realm manage page shows only pinned tab

- **WHEN** a realm owner opens `/realm/:realmId/manage` for a non-default realm
- **THEN** the Pinboard section SHALL show a single `Pinned` tab
- **AND** an `Announcement` tab SHALL NOT be shown

#### Scenario: Non-manager user does not see the section

- **WHEN** a user with realm role `member` and no global admin role opens `/realm/:realmId/manage` through any route
- **THEN** the Pinboard section SHALL NOT be rendered

### Requirement: Pinboard admin editor supports dual-track i18n

The Pinboard admin editor SHALL let a moderator create and edit an entry with one or more languages in a single form session. For each language the form SHALL expose fields for `title`, `summary`, and `body`. The form SHALL enforce that exactly one default language is selected. Adding a language SHALL create a new tab/panel; removing a non-default language SHALL confirm and then soft-delete the corresponding sibling; removing the default language MUST be disallowed by the UI.

The editor SHALL provide inline validation (required `title`, non-empty `defaultLanguage`) and SHALL guard against accidental navigation when there are unsaved changes (using a confirm-modal or route-level block).

On save, the editor SHALL call the composite create/update endpoint and reflect server state in the local query cache. If the save fails, any optimistic mutation SHALL roll back without corrupting the rendered list order.

#### Scenario: Editor creates a multilingual announcement end-to-end

- **WHEN** a moderator opens the Pinboard admin editor, adds `zh-Hans` and `en` languages, fills in title/summary/body for both, and saves
- **THEN** a single API call SHALL create the root unit + sibling + translations + group and append the id to `announcementPostIds`
- **AND** the list SHALL show the new entry at the expected position without a full-page reload

#### Scenario: Default language removal is disabled

- **WHEN** a moderator views the editor for an entry with `defaultLanguage = "zh-Hans"`
- **THEN** the control to remove the `zh-Hans` language tab SHALL be disabled
- **AND** a tooltip or helper text SHALL explain why

#### Scenario: Unsaved-change guard blocks navigation

- **GIVEN** the editor has pending edits
- **WHEN** the user attempts to close the editor or navigate away
- **THEN** a confirm-modal SHALL ask whether to discard changes
- **AND** cancel SHALL keep the user in the editor with their edits intact

#### Scenario: Optimistic update rolls back on failure

- **GIVEN** the editor renders an entry optimistically after the user clicks save
- **WHEN** the server rejects the mutation
- **THEN** the optimistic entry SHALL be rolled back
- **AND** an error toast SHALL surface the failure with a retry affordance

### Requirement: Pinboard reordering uses dnd-kit drag-and-drop

Pinboard entry reordering in the admin editor SHALL be implemented with `dnd-kit`, matching the drag-and-drop patterns already used elsewhere in `@rezics/ui`. The reorder SHALL be visually smooth (no flicker on drop), SHALL support keyboard drag-and-drop for accessibility, and SHALL call the reorder endpoint on drop. If the endpoint responds with HTTP 409 (stale list), the UI SHALL refresh the list and surface a non-blocking toast telling the user the list changed.

#### Scenario: Drag-and-drop reorder persists

- **GIVEN** a pinboard with entries `[A, B, C]`
- **WHEN** the moderator drags `C` above `A`
- **THEN** the optimistic order SHALL be `[C, A, B]`
- **AND** after the reorder endpoint responds OK the list SHALL remain `[C, A, B]`

#### Scenario: Conflict refreshes the list

- **GIVEN** the moderator reorders a stale view of the list
- **WHEN** the endpoint returns HTTP 409
- **THEN** the UI SHALL refetch the pinboard and display the refreshed order
- **AND** a toast SHALL notify the moderator that someone else changed the list

#### Scenario: Keyboard reorder works

- **WHEN** a user with focus on a pinboard row presses the dnd-kit keyboard-drag key combination and uses arrow keys
- **THEN** the row SHALL reorder
- **AND** the same persistence flow as mouse drag SHALL run

### Requirement: Pinboard admin surfaces stale references for cleanup

The Pinboard admin tabs SHALL display a non-blocking banner listing `staleIds` returned by the admin-view read endpoint, with a "Clean up" action that invokes the unpin endpoint for each stale id. The banner SHALL NOT appear when `staleIds` is empty. The banner SHALL be dismissible per session.

#### Scenario: Banner appears when stale ids exist

- **WHEN** the admin-view read returns `staleIds = ["u7"]`
- **THEN** the Pinboard tab SHALL render a banner "1 broken reference" with a "Clean up" action

#### Scenario: Clean up removes stale ids

- **WHEN** the moderator clicks "Clean up" on the stale-id banner
- **THEN** the UI SHALL invoke the unpin endpoint once per stale id
- **AND** the banner SHALL disappear when `staleIds` becomes empty

### Requirement: Pinboard admin destructive actions use confirm modals

Destructive pinboard admin actions (unpin, soft-delete, remove non-default language) SHALL prompt the user with an existing confirm-modal primitive from `@rezics/ui` before executing. The modal SHALL describe the action in the viewer's current language and SHALL provide a cancel affordance.

#### Scenario: Soft-delete requires confirmation

- **WHEN** a moderator clicks "Delete" on a pinboard entry
- **THEN** a confirm modal SHALL appear asking to confirm
- **AND** only on explicit confirmation SHALL the delete endpoint be invoked

### Requirement: Pinboard UI meets loading, empty, and error quality bar

Every pinboard-facing surface (homepage announcement bar, homepage notice board, realm manage pinboard tabs, pinboard admin editor) SHALL implement explicit loading, empty, and error states on first release — no prototype placeholders:

- Loading SHALL use skeleton rows that match final row heights to prevent layout shift.
- Empty SHALL present an illustration or iconographic empty state with a clear primary action where applicable (e.g. "Create announcement").
- Error SHALL present a retry affordance instead of a silent failure.
- Keyboard navigation and screen-reader labels SHALL match the rest of the app (tabs, rows, action buttons all focusable and labeled).

#### Scenario: Skeleton matches final layout

- **WHEN** a pinboard tab is first opened
- **THEN** skeleton rows SHALL occupy the same heights as the eventual real rows
- **AND** the page SHALL NOT visibly reflow when the data arrives

#### Scenario: Error state has retry

- **GIVEN** the pinboard list endpoint errors
- **WHEN** the user sees the error state
- **THEN** a "Retry" button SHALL invoke the query again without a full-page reload

#### Scenario: Empty state guides to primary action

- **WHEN** a moderator opens a Pinboard tab for a realm with no entries
- **THEN** the empty state SHALL render an illustration and a primary "Create" CTA
- **AND** clicking the CTA SHALL open the admin editor in create mode

### Requirement: Pinboard UI respects language switches without reflow

Pinboard-facing surfaces SHALL re-resolve translations when the application language changes without causing a full-page reload or visible flash. Entries lacking a translation for the newly selected language SHALL fall back according to the platform precedence and SHALL render a subtle indicator (tooltip or badge) marking the fallback so users understand why the text may differ.

#### Scenario: Language switch updates announcement bar in place

- **GIVEN** the announcement bar rendering in `en`
- **WHEN** the user switches to `ja`
- **THEN** translated entries SHALL re-render in `ja`
- **AND** entries without a `ja` translation SHALL fall back and mark the row as using a fallback language
