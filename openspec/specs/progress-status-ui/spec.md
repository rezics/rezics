## Requirements

### Requirement: Status control feature folder

The frontend SHALL house all `UserUnitProgress` status-control UI in a dedicated feature at `package/app/src/progress-status/`, structured per the project's feature standard with `models/`, `hooks/`, `states/`, `components/`, `sections/`, and a single `index.ts` public boundary. The `models/` layer SHALL NOT import from `hooks/` or `states/`. External consumers (e.g., `BookHeroActionBar`) SHALL only import from `index.ts`.

#### Scenario: Single public export

- **WHEN** a consumer imports the status control
- **THEN** it imports `BookProgressStatusSection` from `package/app/src/progress-status` (no deep imports into subfolders)
- **AND** all internal types, hooks, components, and atoms SHALL be encapsulated behind that boundary

#### Scenario: models layer is dependency-pure

- **WHEN** any module under `package/app/src/progress-status/models/` is type-checked
- **THEN** it SHALL NOT import from `hooks/`, `states/`, or any React/TanStack Query symbol
- **AND** every function exported from `models/` SHALL be deterministic and unit-testable with `bun test`

### Requirement: Status toggle group plus overflow menu

The status control SHALL render three primary toggles for `BACKLOG` (想讀), `ACTIVE` (在讀), and `COMPLETED` (已讀), plus an overflow menu (`⋯`) that exposes `PAUSED` (擱置), `DROPPED` (棄), and "Remove progress" actions. The overflow trigger SHALL render as the fourth slot in the same visual row and SHALL use `lucide-react` icons by default.

#### Scenario: Selected toggle reflects current status

- **WHEN** the viewer's `UserUnitProgress.status` is `ACTIVE`
- **THEN** the "在讀" toggle SHALL render in the selected (`data-state=on`) state
- **AND** the other three toggles SHALL render unselected
- **AND** if `status` is `PAUSED` or `DROPPED`, none of the three toggles SHALL be selected and the overflow menu SHALL surface the overflow-held state visually (e.g., active dot or label)

#### Scenario: Overflow menu exposes Dropped and Remove progress

- **WHEN** the user opens the `⋯` overflow menu
- **THEN** the menu SHALL list at least: `擱置` (PAUSED), `棄` (DROPPED), and `移除進度` (Remove progress)
- **AND** activating `擱置` SHALL initiate a `PAUSED` transition
- **AND** activating `棄` SHALL initiate a `DROPPED` transition
- **AND** activating `移除進度` SHALL call `DELETE /me/units/:unitId/progress` and remove shelf membership from any mirrored shelf currently containing the unit

### Requirement: BACKLOG transition and removal

The system SHALL transition to `BACKLOG` synchronously without opening a modal when the current status is not already `BACKLOG`. That transition SHALL be a frontend dual-write: a `PUT /me/units/:unitId/progress` setting `status: "BACKLOG"`, and shelf operations per the transition rules. If the current status is already `BACKLOG`, clicking `想讀` SHALL open a confirmation modal for soft removal.

#### Scenario: Direct BACKLOG add from no-row

- **WHEN** a user with no `UserUnitProgress` row clicks `想讀`
- **THEN** the client SHALL issue `PUT` with `{ status: "BACKLOG" }` and `POST` to add the unit to the user's `backlog` system shelf
- **AND** no modal SHALL be displayed
- **AND** the toggle SHALL update optimistically to the selected state

#### Scenario: Re-click BACKLOG confirms soft removal

- **WHEN** the current status is `BACKLOG` and the user clicks `想讀`
- **THEN** the client SHALL open a confirmation modal
- **WHEN** the user confirms
- **THEN** the client SHALL invoke `DELETE /me/units/:unitId/progress`
- **AND** the backend SHALL soft-delete the `UserUnitProgress` row rather than physically deleting it
- **AND** the client SHALL remove the unit from the user's `backlog` system shelf
- **AND** the visible toggle selection SHALL clear

### Requirement: ACTIVE modal edits progress and last position

Selecting `ACTIVE` (在讀) SHALL open a modal with a progress slider (`0`–`100`%, `1`% granularity) and an optional chapter picker fed by `BookContentStructure.nodes`. The modal SHALL be reachable both for transitions into `ACTIVE` and for re-clicks while already `ACTIVE` (i.e., it doubles as an edit affordance).

#### Scenario: First entry into ACTIVE opens the modal

- **WHEN** the current status is not `ACTIVE` and the user clicks `在讀`
- **THEN** the system SHALL open the active-progress modal pre-filled with the existing `progress` (or `0` if absent) and `lastPosition`
- **AND** confirming SHALL `PUT` `{ status: "ACTIVE", progress, lastPosition }` and dual-write the shelf transition

#### Scenario: Re-click ACTIVE re-opens the modal

- **WHEN** the current status is `ACTIVE` and the user clicks `在讀`
- **THEN** the system SHALL open the same modal pre-filled with the current `progress` and `lastPosition`
- **AND** the shelf transition list SHALL be empty (no shelf op) for save

#### Scenario: Chapter picker uses BookContentStructure

- **WHEN** the modal renders the chapter picker
- **THEN** the picker SHALL hydrate from the existing book content-structure source for the active book unit
- **AND** selecting a chapter SHALL produce a `chapterLastPosition` payload (`{ kind: "chapter", chapterUnitId }`) for the upsert

#### Scenario: Chapter picker is optional

- **WHEN** the user saves the modal without choosing a chapter
- **THEN** the system SHALL preserve the existing `lastPosition` (or leave it `null`) and SHALL NOT block saving

### Requirement: PAUSED and DROPPED reason modals share UI

`PAUSED` (擱置) and `DROPPED` (棄) SHALL each open a reason composer modal. The two modals SHALL share component code and differ only by i18n keys, target status, and the `extra` slot they read/write (`extra.paused.reasonPostUnitIds` vs `extra.dropped.reasonPostUnitIds`). The modal SHALL accept skipping (no post written) and SHALL expose a visibility toggle (`PUBLIC` default, `UNLISTED` private).

#### Scenario: First PAUSED creates a new reason post

- **WHEN** the user transitions to `PAUSED` for the first time (the relevant `extra.paused` is empty or absent)
- **AND** the user types a body and clicks `儲存`
- **THEN** the client SHALL `POST /post` with `{ kindKey: "post", targetUnitId, body, visibility }` to create the reason post
- **AND** SHALL `PUT` progress with `{ status: "PAUSED", extra: { paused: { reasonPostUnitIds: [<newPostId>] } } }`
- **AND** SHALL dual-write any required shelf removal

#### Scenario: Re-PAUSED defaults to editing the latest post

- **WHEN** the user re-enters the `PAUSED` modal with a non-empty `reasonPostUnitIds` array
- **THEN** the modal SHALL pre-fill the textarea with the body of the array's last post
- **AND** clicking `儲存` SHALL `PATCH` that latest post's body and SHALL NOT modify the array

#### Scenario: Explicit "新增" appends a new post

- **WHEN** the user clicks the explicit `新增` action in the reason modal
- **THEN** the client SHALL `POST` a new post and append its id to the end of `reasonPostUnitIds`
- **AND** the older posts SHALL remain bound and visible in the modal's history disclosure

#### Scenario: Skip writes status only

- **WHEN** the user clicks `跳過` in the reason modal
- **THEN** the client SHALL `PUT` progress with the new status only (no `extra` write, no post mutation)
- **AND** SHALL still dual-write any required shelf removal

#### Scenario: Visibility toggle applies to new posts

- **WHEN** the visibility toggle is set to `不公開` and the user creates or appends a post
- **THEN** the `POST /post` body SHALL include `visibility: "UNLISTED"`
- **AND** the existing posts in the array SHALL NOT have their visibility changed

### Requirement: Reason history rendering

The reason modal SHALL render the `reasonPostUnitIds` array with the newest entry on top. Older entries beyond the latest SHALL appear in a collapsible disclosure as read-only previews (the disclosure may be expanded to view full bodies).

#### Scenario: Newest post displayed at top

- **WHEN** the array contains three post ids appended over time
- **THEN** the modal SHALL display them in reverse-append order (newest → oldest)
- **AND** the latest one SHALL be loaded into the editable textarea
- **AND** the older two SHALL be in the collapsible history section

### Requirement: COMPLETED confirm modal with optimistic +1

Selecting `COMPLETED` SHALL open a confirm modal that displays the current `completedCount` and a brand-color `+1` preview. On confirm, the client SHALL optimistically animate the count from `n → n+1`, fade the `+1` symbol, then close the modal, while the underlying `PUT /me/units/:unitId/progress` runs with `{ status: "COMPLETED", completedCount: n + 1 }` and the dual-write shelf side-effect runs in parallel. Cancellation SHALL leave all stored state unchanged. If a previously soft-deleted progress row exists, the update SHALL restore it.

#### Scenario: First completion increments count by one

- **WHEN** a user with `completedCount = 0` confirms the COMPLETED modal
- **THEN** the modal SHALL animate `0 → 1`
- **AND** the client SHALL `PUT` with `{ status: "COMPLETED", completedCount: 1 }`
- **AND** SHALL add the unit to the user's `completed` system shelf
- **AND** SHALL remove the unit from the user's `active` shelf if it was there

#### Scenario: Re-read on already-completed bumps the count

- **WHEN** the current status is `COMPLETED` with `completedCount = 7` and the user re-clicks `已讀` and confirms
- **THEN** the modal SHALL animate `7 → 8`
- **AND** the client SHALL `PUT` with `{ status: "COMPLETED", completedCount: 8 }`
- **AND** SHALL NOT remove the unit from the `completed` shelf (add-only semantics)

#### Scenario: Cancel rolls back the optimistic preview

- **WHEN** the user cancels the COMPLETED modal
- **THEN** no network request SHALL be issued
- **AND** the visible `completedCount` SHALL remain at its prior value
- **AND** no shelf operation SHALL run

### Requirement: Frontend dual-write to system shelves

For each status transition, the frontend SHALL compute a list of `ShelfOp`s via a pure `planTransition(from, to)` function and issue them in parallel with the progress upsert. The plan SHALL implement these rules:

- Leaving `BACKLOG` or `ACTIVE` SHALL produce a `remove` op against the corresponding mirrored system shelf.
- Entering `BACKLOG` or `ACTIVE` SHALL produce an `add` op against the corresponding mirrored system shelf.
- Entering `COMPLETED` SHALL produce an `add` op against the `completed` system shelf.
- Leaving `COMPLETED` SHALL NOT produce any `remove` op (add-only semantics).
- Entering or leaving `PAUSED` or `DROPPED` SHALL NOT produce any add op for those statuses; they have no system shelf.

#### Scenario: BACKLOG → ACTIVE moves shelf membership

- **WHEN** the user transitions from `BACKLOG` to `ACTIVE`
- **THEN** the plan SHALL contain `[remove backlog, add active]`
- **AND** both ops SHALL be issued in parallel with the progress `PUT`

#### Scenario: ACTIVE → COMPLETED removes from active and adds to completed

- **WHEN** the user transitions from `ACTIVE` to `COMPLETED`
- **THEN** the plan SHALL contain `[remove active, add completed]`

#### Scenario: COMPLETED → ACTIVE keeps completed membership

- **WHEN** the user transitions from `COMPLETED` to `ACTIVE` (re-read)
- **THEN** the plan SHALL contain `[add active]` only
- **AND** the unit SHALL remain in the `completed` shelf

#### Scenario: PAUSED transition has no add op

- **WHEN** the user transitions from `ACTIVE` to `PAUSED`
- **THEN** the plan SHALL contain `[remove active]` only
- **AND** no `paused` shelf operation SHALL be attempted

#### Scenario: Same-status transition produces no shelf ops

- **WHEN** the user re-clicks the current status
- **THEN** `planTransition(from, to)` with `from == to` SHALL return `[]`
- **AND** any modal save SHALL still issue the progress `PUT`

### Requirement: Partial-failure toast and independent retry

When the parallel mutations resolve, any rejected mutation SHALL surface a toast that names the failed half and offers a retry. Successful halves SHALL NOT be rolled back; the user SHALL be able to retry only the failed mutation. Concurrent identical retries against the same `(unitId, op)` SHALL be debounced.

#### Scenario: Progress write succeeds, shelf write fails

- **WHEN** the progress `PUT` resolves successfully and a shelf `POST` rejects
- **THEN** the UI SHALL display a toast such as "進度已更新，但加入書架失敗" with a `Retry` action
- **AND** the toggle SHALL remain in the new status (progress is durable)
- **AND** clicking `Retry` SHALL re-issue only the shelf op

#### Scenario: Both halves fail

- **WHEN** both the progress `PUT` and the shelf `POST` reject
- **THEN** the UI SHALL roll back the optimistic toggle selection
- **AND** display a single toast covering both failures with a single `Retry` action that re-issues both

### Requirement: System shelf id resolution on the client

The client SHALL resolve the four system shelf unit ids (`favorites`, `backlog`, `active`, `completed`) for the current user before executing shelf ops. The resolution SHALL come from the user DTO returned by `GET /user/me`, which SHALL be extended to include a `systemShelves` map keyed by system kindKey. The client SHALL cache this map for the session.

#### Scenario: User DTO carries system shelf ids

- **WHEN** the client queries `GET /user/me`
- **THEN** the response SHALL include `systemShelves: { favorites?, backlog?, active?, completed? }` with each value (when present) being the corresponding `Shelf.unitId` for that user

#### Scenario: Missing system shelf is lazy-created on first use

- **WHEN** a transition requires a shelf id that is missing from the cached `systemShelves` map
- **THEN** the client SHALL call the existing `getOrCreateSystemShelf` server path (or refetch `/user/me`) to obtain the id, then proceed with the shelf op
- **AND** the resolution SHALL update the cached map for subsequent ops in the session

### Requirement: Toast and modal copy localization

All user-visible strings (toggle labels, modal titles, button labels, toast messages, overflow menu items) SHALL go through the existing `i18next` `t()` helper with both zh-Hant and en keys defined. Hard-coded Chinese or English strings in components are prohibited; fallbacks via the second `t(key, fallback)` argument are allowed for incremental rollout.

#### Scenario: All strings have an i18n key

- **WHEN** the feature is built
- **THEN** every visible string SHALL be sourced from a `t("...")` call
- **AND** the project's existing translation files SHALL contain entries for both supported locales

### Requirement: Accessibility of the status control

The toggle group SHALL be keyboard-navigable (arrow keys move focus, space/enter activates). Modals SHALL trap focus, expose proper aria roles via the underlying shadcn `Dialog`, and SHALL close on `Escape`. The `+1` animation SHALL respect `prefers-reduced-motion` by skipping the count animation while still updating the displayed number.

#### Scenario: Reduced-motion users see no animation

- **WHEN** the OS reports `prefers-reduced-motion: reduce` and the user confirms COMPLETED
- **THEN** the count SHALL update immediately to `n + 1` without an interpolated transition
- **AND** the modal SHALL still close on confirm
