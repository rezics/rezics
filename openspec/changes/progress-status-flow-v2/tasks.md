## 1. Contract narrowing

- [ ] 1.1 In `package/contract/src/progress.ts`, add a `progressExtraSchema` Typebox object with optional `paused` and `dropped` keys, each holding `{ reasonPostUnitIds: string[] }`, with `additionalProperties: false`. Export `ProgressExtra` static type.
- [ ] 1.2 Replace `extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any())))` in `unitProgressUpsertBodySchema` with `t.Optional(t.Nullable(progressExtraSchema))`. Same for `extra: t.Nullable(t.Record(t.String(), t.Any()))` in `unitProgressRowDTOSchema`.
- [ ] 1.3 Add unit tests in `package/contract/src/progress.test.ts` covering: accepted shape, rejected unknown top-level key, accepted empty object, accepted `null`.
- [ ] 1.4 Run `bun -F @rezics/contract test` and `bun -F @rezics/contract run typecheck` (or `tsc --noEmit`) to confirm the package builds.

## 2. Server validation and lenient read

- [ ] 2.1 In `package/server/src/progress/progress.service.ts` (and any direct callers of the upsert), validate the incoming `extra` against the new `progressExtraSchema`. Reject with a 400 on unknown top-level keys. Pure pass-through for valid shapes.
- [ ] 2.2 In `package/server/src/progress/progress.mapper.ts`, when mapping a stored row to DTO, strip any unrecognized top-level keys from `extra` so legacy rows don't surface garbage.
- [ ] 2.3 Add tests in `package/server/src/progress/progress.service.test.ts` for: write with valid `paused.reasonPostUnitIds`, write rejected for unknown key, read sanitizes legacy shapes.
- [ ] 2.4 Run `bun -F @rezics/server test` to confirm.

## 3. User DTO carries system shelf ids

- [ ] 3.1 In `package/contract/src/user.ts` (or wherever the `UserDTO` is defined), add `systemShelves?: { favorites?: string; backlog?: string; active?: string; completed?: string }`.
- [ ] 3.2 In `package/server/src/user/api/user.core.api.ts` `GET /me`, populate `systemShelves` from `User.extra.shelves` (existing). Do not bootstrap missing keys here — let the lazy-create path run on first transition.
- [ ] 3.3 In `package/server/src/user/user.mapper.ts` (or equivalent), update `mapUserToDTO` to include the new field.
- [ ] 3.4 Update `package/api/src/user/user.api.ts` and queries if any TypeScript shape changes.
- [ ] 3.5 Run `bun -F @rezics/server test` and `bun -F @rezics/contract test`.

## 4. Models layer (pure)

- [ ] 4.1 Create `package/app/src/progress-status/models/status.ts` with `ReadStatus` mapping (`BACKLOG`/`ACTIVE`/`PAUSED`/`COMPLETED`/`DROPPED` ↔ user-facing labels in zh-Hant/en).
- [ ] 4.2 Create `package/app/src/progress-status/models/transition.ts` exporting `planTransition(from, to): ShelfOp[]` per the spec rules (mirror move for backlog/active, add-only for completed, no-op for paused/dropped, empty for same-status).
- [ ] 4.3 Create `package/app/src/progress-status/models/extra.ts` re-exporting `ProgressExtra` from `@rezics/contract` and adding read helpers (`getReasonPostIds(extra, status)` etc.).
- [ ] 4.4 Add `package/app/src/progress-status/models/transition.test.ts` covering the full transition matrix from the spec scenarios.
- [ ] 4.5 Run `bun -F @rezics/app test` for the new test file.

## 5. Hooks layer

- [ ] 5.1 Create `package/app/src/progress-status/hooks/useSystemShelfIds.ts` that reads `systemShelves` from the cached `useMe()` result and exposes a getter `getShelfId(kindKey): string | undefined`.
- [ ] 5.2 Create `package/app/src/progress-status/hooks/useStatusTransition.ts`. Inputs: `unitId`, `currentStatus`. Returns a `transition({ to, progress?, lastPosition?, extra?, completedCount? })` async function that issues the progress `PUT` and the planned shelf ops via `Promise.allSettled` and surfaces a partial-failure toast with retry. Use existing `useUpdateUnitProgress`, `useCollectMutation` or `useAddItemMutation`, and `useRemoveItemMutation`.
- [ ] 5.3 Create `package/app/src/progress-status/hooks/useReasonPostHistory.ts` that takes an array of post unitIds and returns their bodies via TanStack Query (use the existing post detail query keys; consider a batched query if available).
- [ ] 5.4 Create `package/app/src/progress-status/hooks/useChapterPicker.ts` that hydrates `BookContentStructure.nodes` for a given book unitId and flattens to a list of `{ chapterUnitId, label }` for the picker.
- [ ] 5.5 Add a `package/app/src/progress-status/hooks/useReasonPostMutations.ts` exposing `createReasonPost({ unitId, body, visibility })` and `updateReasonPost(postUnitId, { body, visibility })` wrapping the existing post API.
- [ ] 5.6 Type-check with `bun -F @rezics/app exec tsc --noEmit`.

## 6. State layer

- [ ] 6.1 Create `package/app/src/progress-status/states/statusModalAtom.ts` (Jotai). Atom shape: `{ kind: "active" | "reason" | "completed" | null; status: UserUnitProgressStatus | null; draft: { progress?, lastPosition?, body?, visibility? } }`. Helpers: `openModal`, `closeModal`, `updateDraft`.

## 7. Components — modals and controls

- [ ] 7.1 Create `package/app/src/progress-status/components/StatusToggleGroup.tsx` mirroring the existing toggle row in `BookHeroActionBar.tsx` (4 toggles, controlled value, `onValueChange`). Use shadcn `ToggleGroup` and `lucide-react` icons. Apply project token classes (no raw hex).
- [ ] 7.2 Create `package/app/src/progress-status/components/StatusOverflowMenu.tsx` — `⋯` button opening a shadcn `DropdownMenu` with `棄` (DROPPED) and `移除進度` items. Visually attached to the toggle group row.
- [ ] 7.3 Create `package/app/src/progress-status/components/ChapterPicker.tsx` — shadcn `Combobox` (or `Select`) backed by `useChapterPicker`. Hierarchical labels (`Vol > Ch`). Optional selection.
- [ ] 7.4 Create `package/app/src/progress-status/components/ActiveProgressModal.tsx` — shadcn `Dialog` with a slider (`0–100`, step `1`) and the `ChapterPicker`. Save calls back into the section's `transition`.
- [ ] 7.5 Create `package/app/src/progress-status/components/ReasonModal.tsx` — shared by PAUSED and DROPPED, parameterized by status. Shows latest-post textarea (or empty), history disclosure, visibility toggle (`PUBLIC` default; maps to `UNLISTED` when private), and three buttons: `跳過`, `儲存` (edit latest or create-on-empty), `新增` (always append). The `新增` button is hidden when the array is empty.
- [ ] 7.6 Create `package/app/src/progress-status/components/CompletedConfirmModal.tsx` — renders current count and a brand-color `+1` badge. Confirm triggers the optimistic animation: count `n → n+1` over ~220ms, `+1` badge fade ~160ms, modal close ~150ms. Respect `prefers-reduced-motion` by snapping the count without animating.
- [ ] 7.7 Ensure all visible strings flow through `t()` with zh-Hant + en entries added to the existing translation files. No hard-coded copy.

## 8. Section wiring

- [ ] 8.1 Create `package/app/src/progress-status/sections/BookProgressStatusSection.tsx` that composes the toggle group, overflow menu, and the four modals; manages the modal atom; resolves system shelf ids via `useSystemShelfIds`; and dispatches `transition()`.
- [ ] 8.2 Implement same-status click handling per the spec: BACKLOG = no-op; ACTIVE/PAUSED/DROPPED = re-open modal; COMPLETED = re-open `+1` confirm (re-read).
- [ ] 8.3 Implement "Remove progress" via the existing `useDeleteUnitProgress` plus a parallel shelf `remove` op for the currently mirrored shelf (if any). Do not touch `completed`.
- [ ] 8.4 Wire optimistic toggle-group selection updates and rollback on failure.
- [ ] 8.5 Create `package/app/src/progress-status/index.ts` exporting only `BookProgressStatusSection` (and any types consumers need).

## 9. Integration with BookHeroActionBar

- [ ] 9.1 In `package/app/src/book-library/sections/BookHeroActionBar.tsx`, remove the inlined toggle group, complete dialog, `completedCountInput` state, and related handlers.
- [ ] 9.2 Mount `<BookProgressStatusSection bookId={bookId} bookInfo={bookInfo} />` in place of the removed block. Keep the `加入書架` button and Share/Edit row unchanged.
- [ ] 9.3 Remove now-unused imports (`Dialog*`, `Input`, `Label`, `ToggleGroup*`, `mapProgressStatus`, `useUpdateUnitProgress`, `useUnitProgress` if no other use).
- [ ] 9.4 Run `bun -F @rezics/app exec tsc --noEmit` to confirm no dangling references.

## 10. Toast and error UX

- [ ] 10.1 Add toast keys for the four error variants: progress-only failure, shelf-only failure, both-failed, generic retry. Both languages.
- [ ] 10.2 In `useStatusTransition`, debounce identical retries against the same `(unitId, op)` so users mashing the retry button don't fan out parallel writes.

## 11. Convention check, tests, build

- [ ] 11.1 Run `bun run check:convention` (per CLAUDE.md, includes link rendering and other R-rules).
- [ ] 11.2 Run `bun -F @rezics/app exec tsc --noEmit`, `bun -F @rezics/contract exec tsc --noEmit`, `bun -F @rezics/server exec tsc --noEmit` (per package per memory).
- [ ] 11.3 Run `bun test` in each touched package.
- [ ] 11.4 Run `bun run knip` and clean any unused exports created by this change.

## 12. Manual verification

- [ ] 12.1 Start the dev stack (`bun run dev`) and exercise the flow on a real book unit: BACKLOG → ACTIVE → PAUSED → ACTIVE → COMPLETED → COMPLETED (re-read) → DROPPED → Remove progress. Confirm the shelf membership matches the spec at each step (use Prisma Studio or the profile shelves tab).
- [ ] 12.2 Force a network failure on the shelf write and verify the partial-failure toast appears with a working `Retry`.
- [ ] 12.3 Verify the `+1` animation order in COMPLETED confirm and that `prefers-reduced-motion` skips the interpolation.
- [ ] 12.4 Verify reason posts: first PAUSED creates a public post, edit-in-place modifies it, `新增` appends a new id to the array, history disclosure shows older posts.
