## ADDED Requirements

### Requirement: ShelfAction button drives the existing CollectionModal

The `ShelfAction` atom (rendered by `ReactionBar` when the `"shelf"` action token is present) SHALL render an icon (📚) plus the label "Shelf" (localised). Clicking the button SHALL open the existing `CollectionModal` (`package/app/src/collection/components/CollectionModal.tsx`) via the existing `useCollectionModal(targetId)` hook. `ShelfAction` SHALL NOT perform any mutation itself; all mutation work lives in the hook + modal, which already wrap `useCollectMutation`.

This change SHALL NOT introduce a new `ShelfPickerModal` component. `CollectionModal` and `useCollectionModal` are treated as pre-existing infrastructure and remain in `collection/`.

#### Scenario: Clicking ShelfAction opens the existing modal
- **WHEN** a signed-in user clicks the shelf button on a `ReactionBar`
- **THEN** `CollectionModal` opens with the content's `targetId` bound via `useCollectionModal`

#### Scenario: Clicking ShelfAction while signed out triggers sign-in
- **WHEN** an unauthenticated user clicks the shelf button
- **THEN** the modal SHALL NOT open
- **AND** the app's standard sign-in prompt SHALL surface instead

#### Scenario: No duplicate picker is introduced
- **WHEN** a developer inspects `package/app/src/engagement/`
- **THEN** no file named `ShelfPickerModal.tsx` (or an equivalent duplicate multi-select modal) SHALL exist
- **AND** `rg "ShelfPickerModal"` under `package/app/` SHALL return zero matches

### Requirement: ShelfAction lives under engagement and imports across the collection boundary

`ShelfAction` SHALL be exported from `package/app/src/engagement/` (e.g. `engagement/components/ShelfAction.tsx` and re-exported from `engagement/index.ts`). It SHALL import `CollectionModal` and `useCollectionModal` from `@/collection/*`. This is the single permitted cross-feature coupling this change introduces; the rationale is that `collection/` is out of scope for modification but its existing modal is the canonical multi-select shelf picker.

#### Scenario: ShelfAction imports CollectionModal from collection/
- **WHEN** a developer inspects `ShelfAction.tsx`
- **THEN** `CollectionModal` and `useCollectionModal` SHALL be imported from `@/collection/*`
- **AND** no other engagement component SHALL depend on `collection/*` imports

### Requirement: FavoriteButton is not replaced in this change

The existing `FavoriteButton` component (`package/app/src/collection/components/FavoriteButton.tsx`) and the underlying `useToggleFavoriteMutation` call SHALL remain in place and unchanged by this change. `ShelfAction` and `FavoriteButton` represent distinct user intents: `FavoriteButton` is a one-click toggle on a single implicit favorite shelf, `ShelfAction` is a multi-select picker over all shelves.

#### Scenario: FavoriteButton continues to render
- **WHEN** a surface currently renders `FavoriteButton`
- **THEN** after this change `FavoriteButton` still renders and behaves identically

#### Scenario: ReactionBar does not call into FavoriteButton
- **WHEN** a developer inspects `ReactionBar`, `ShelfAction`, or `ShelfPickerModal`
- **THEN** none of them import `FavoriteButton` or `useToggleFavoriteMutation`
