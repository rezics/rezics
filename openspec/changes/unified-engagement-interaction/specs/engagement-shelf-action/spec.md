## ADDED Requirements

### Requirement: ShelfAction button opens a shelf picker modal

The `ShelfAction` atom (rendered by `ReactionBar` when the `"shelf"` action token is present) SHALL render an icon (📚) plus the label "Shelf" (localised). Clicking the button SHALL open a single shared `ShelfPickerModal` component. `ShelfAction` SHALL NOT perform any mutation itself; all mutation work lives in the modal.

#### Scenario: Clicking ShelfAction opens the picker modal
- **WHEN** a signed-in user clicks the shelf button on a `ReactionBar`
- **THEN** `ShelfPickerModal` opens with the content's target id passed as `targetId`

#### Scenario: Clicking ShelfAction while signed out triggers sign-in
- **WHEN** an unauthenticated user clicks the shelf button
- **THEN** the modal SHALL NOT open
- **AND** the app's standard sign-in prompt SHALL surface instead

### Requirement: Shelf picker modal selects multiple shelves

`ShelfPickerModal` SHALL accept a `targetId: string` prop and display:

- A list of the current user's shelves, fetched via the existing `shelfKeys.mine()` query.
- A checkbox next to each shelf, pre-checked for shelves that already contain `targetId` (derived from the collection-status query for that target).
- A primary action button labelled "Save" (localised) that dispatches a single `useCollectMutation({ targetId, shelfIds })` call with the full current selection.
- A secondary action "Cancel" that closes the modal without mutating.
- A footer link / button to create a new shelf inline (opens the existing create-shelf dialog or routes to the create-shelf page; reuse whichever shelf-creation affordance currently exists without introducing a third path).

Pre-existing memberships and newly selected shelves SHALL both appear as checked. Submitting the modal SHALL add the target to any newly checked shelf and remove it from any newly unchecked shelf (i.e. the mutation is treated as the authoritative new-state of the target's shelf memberships, matching the existing `useCollectMutation` contract that returns `savedTo: string[]`).

#### Scenario: Multi-select save succeeds
- **WHEN** a user selects shelves A, B, and C in the modal and clicks "Save"
- **THEN** a single `useCollectMutation` call fires with `{ targetId, shelfIds: [A, B, C] }`
- **AND** the modal closes
- **AND** the target appears in each selected shelf's detail / items cache after invalidation

#### Scenario: Pre-existing memberships are reflected
- **WHEN** the user opens the modal for a target already saved to shelf A
- **THEN** shelf A's checkbox is pre-checked on open

#### Scenario: Unchecking an existing membership removes the target
- **WHEN** the user unchecks shelf A (where the target was previously saved) and clicks "Save"
- **THEN** the mutation call reflects the new `shelfIds` omitting A
- **AND** the target is removed from shelf A

#### Scenario: Create-new-shelf affordance is reachable
- **WHEN** the modal is open
- **THEN** a visible control SHALL let the user start the shelf-creation flow without losing the current target context

### Requirement: ShelfPickerModal lives under engagement, not under shelf

`ShelfPickerModal` SHALL be exported from `package/app/src/engagement/` (e.g. `engagement/components/ShelfPickerModal.tsx` and re-exported from `engagement/index.ts`). Content features SHALL import it via the engagement public barrel, not via `shelf/*` internals. Rationale: the modal is an interaction-layer component shared across every content type, not a shelf-feature UI.

#### Scenario: Import path is engagement-based
- **WHEN** a developer inspects `ShelfAction.tsx`
- **THEN** the import of the modal uses `@/engagement` or an engagement-internal relative path
- **AND** no import path containing `@/shelf/` appears

### Requirement: FavoriteButton is not replaced in this change

The existing `FavoriteButton` component (`package/app/src/collection/components/FavoriteButton.tsx`) and the underlying `useToggleFavoriteMutation` call SHALL remain in place and unchanged by this change. `ShelfAction` and `FavoriteButton` represent distinct user intents: `FavoriteButton` is a one-click toggle on a single implicit favorite shelf, `ShelfAction` is a multi-select picker over all shelves.

#### Scenario: FavoriteButton continues to render
- **WHEN** a surface currently renders `FavoriteButton`
- **THEN** after this change `FavoriteButton` still renders and behaves identically

#### Scenario: ReactionBar does not call into FavoriteButton
- **WHEN** a developer inspects `ReactionBar`, `ShelfAction`, or `ShelfPickerModal`
- **THEN** none of them import `FavoriteButton` or `useToggleFavoriteMutation`
