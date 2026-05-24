## 1. Audit

- [ ] 1.1 Inventory every `unitApi.upsertTranslation`,
      `useUpsertTranslationMutation`, `unitApi.deleteTranslation`, and
      `useDeleteTranslationMutation` caller.
- [ ] 1.2 Identify every caller whose visible read model is a domain detail
      cache rather than `unitKeys.detail`.
- [ ] 1.3 Audit domain mutations that write full detail DTOs with
      `queryClient.setQueryData(<domain>Keys.detail(...), data)` while adjacent
      mutations can also update embedded `translations[]`.

## 2. API Cache Helpers

- [ ] 2.1 Add a shared helper for replacing/appending/removing one
      `UnitTranslationDTO` in cached DTOs with `translations[]`.
- [ ] 2.2 Add a helper for cancelling and patching exact detail query keys before
      invalidating broader list/search prefixes.
- [ ] 2.3 Add tests for translation append, replace, remove, and preserving other
      DTO fields.

## 3. Unit Translation Mutations

- [ ] 3.1 Extend `useUpsertTranslationMutation` to accept affected domain detail
      keys and patch those caches from the returned `UnitTranslationDTO`.
- [ ] 3.2 Extend `useDeleteTranslationMutation` to accept affected domain detail
      keys and remove the deleted language from those caches.
- [ ] 3.3 Keep existing `unitKeys.detail(unitId)` and `unitKeys.lists()`
      invalidation behavior.
- [ ] 3.4 Add mutation tests proving domain detail cache updates before caller
      `onSuccess` runs.

## 4. Book Edit Fixes

- [ ] 4.1 Use the extended translation mutation in `BookEditInfoSection` with
      `bookKeys.detail(bookId)` as an affected detail key.
- [ ] 4.2 Ensure a successful translation save updates `bookKeys.detail(bookId)`
      before `editor.clearDraft(...)`.
- [ ] 4.3 Fix metadata-plus-translation saves so a full Book metadata response
      cannot overwrite a fresher cached translation from the same submit.
- [ ] 4.4 Update translation add/delete flows to keep `bookKeys.detail(bookId)`
      coherent.
- [ ] 4.5 Update `SetSourceReleaseControl` so changing `sourceReleaseUnitId`
      updates or invalidates `bookKeys.detail(bookId)`.
- [ ] 4.6 Add regression tests for save-then-clear-draft showing the edited
      title/summary/description remains visible without a hard refresh.

## 5. Other Callers

- [ ] 5.1 Confirm `RealmManagePage` remains coherent; migrate to the shared
      mutation helper if that reduces duplication.
- [ ] 5.2 Update `PinboardAdminSection` direct translation saves so affected
      visible caches are invalidated or patched, not only the local pinboard
      refetch.
- [ ] 5.3 Audit source-release and translation-group mutations for affected
      domain detail invalidation.

## 6. Verification

- [ ] 6.1 Run targeted API mutation tests.
- [ ] 6.2 Run targeted Book edit tests.
- [ ] 6.3 Run `bun run check:convention`.
- [ ] 6.4 Manually verify Book edit: save translation, save metadata plus
      translation, add translation, delete translation, change source release,
      and confirm no hard refresh is needed.
