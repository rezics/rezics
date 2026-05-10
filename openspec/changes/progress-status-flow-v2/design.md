## Context

`UserUnitProgress` ships today through `package/app/src/book-library/sections/BookHeroActionBar.tsx` as a four-button `ToggleGroup` plus a numeric-input "completed count" `Dialog`. The existing `user-unit-progress` capability spec already mandates that `UserUnitProgress` and the `Shelf` family are **orthogonal stores** (`spec.md` §`Progress and shelf are orthogonal stores`) and that frontend dual-writes are the integration mechanism. It also already specifies `User.extra.shelves` pointers to the four system shelves (`favorites`, `backlog`, `active`, `completed`) with bootstrap and lazy-create semantics, implemented at `package/server/src/shelf/system-shelves.ts`.

What's missing is the **frontend half** of the dual-write contract and a real interaction model on top of the five-state status enum (`BACKLOG | ACTIVE | PAUSED | COMPLETED | DROPPED`). The current UI silently writes only to `UserUnitProgress`, never touches shelves, has no `DROPPED` affordance, no reason-capture on pause/drop, and uses an arbitrary numeric input where the product wants a per-click `+1` reading-count gesture.

This design extracts the status UI into a self-contained `progress-status` feature folder, formalizes the shelf side-effect rules as a pure transition function, and specifies the four modal interactions (`ACTIVE` progress editor, `PAUSED`/`DROPPED` reason composer, `COMPLETED` `+1` confirm).

Stakeholders: frontend (`@rezics/app`), contract (`@rezics/contract`), server-side validation (`@rezics/server`), and design system (rezics-design — modals, slider, toast).

## Goals / Non-Goals

**Goals:**
- One canonical place for status-control UI with a clean public boundary (`<BookProgressStatusSection bookId>`).
- A pure, unit-tested transition function `planTransition(from, to) → ShelfOp[]` that captures the move/add-only/none rules in one spot.
- Per-status modal flows that match the agreed UX (no modal on `BACKLOG`, progress editor on `ACTIVE`, reason composer on `PAUSED`/`DROPPED`, `+1` confirm on `COMPLETED`).
- `extra` narrowed to a per-status shape that supports a growing array of reason posts per status, newest rendered first, with edit-the-latest as the default save action.
- Frontend dual-write to system shelves with partial-failure toast and independently retriable mutations. No backend coupling.
- `+1` confirm choreography: optimistic preview → confirm → animate `n → n+1` → fade `+1` → close.

**Non-Goals:**
- Backend reconciliation between progress and shelves (still forbidden by `user-unit-progress/spec.md`).
- Status UI for non-`BOOK` unit types (the data layer is generic; copy/labels stay book-flavored for now).
- Reason-post threading, replies, moderation, or analytics — reason posts are ordinary `Post` rows.
- A dedicated `paused`/`dropped` system shelf — these statuses intentionally have no shelf membership.
- Schema migration on `UserUnitProgress.extra` — the column is already `Json?`; we tighten only at the contract layer.

## Decisions

### D1. Feature folder location and shape

Create `package/app/src/progress-status/` following `package/app/docs/feature standard.md`:

```
progress-status/
├── models/
│   ├── status.ts                # ReadStatus type + label/icon mapping
│   ├── transition.ts            # planTransition(from,to) → ShelfOp[]
│   └── extra.ts                 # ProgressExtra narrow type + parser
├── hooks/
│   ├── useStatusTransition.ts   # orchestrates dual-write, surfaces toast
│   ├── useReasonPostHistory.ts  # fetch posts referenced by the array
│   ├── useChapterPicker.ts      # pulls book content structure
│   └── useSystemShelfIds.ts     # resolves user's four shelf unitIds
├── states/
│   └── statusModalAtom.ts       # Jotai atom: open kind + draft fields
├── components/
│   ├── StatusToggleGroup.tsx
│   ├── StatusOverflowMenu.tsx   # ⋯ → Dropped / Remove progress
│   ├── ActiveProgressModal.tsx
│   ├── ReasonModal.tsx          # PAUSED + DROPPED share UI; differ by i18n
│   ├── CompletedConfirmModal.tsx
│   └── ChapterPicker.tsx
├── sections/
│   └── BookProgressStatusSection.tsx
└── index.ts                     # only public export: BookProgressStatusSection
```

**Why a feature folder, not a UI primitive:** the work mixes models, side-effecting hooks, atoms, and several composed modals — exactly the layered shape the project's feature standard prescribes. Putting it under `@rezics/ui` would couple a shared primitive package to TanStack Query and Jotai, which it doesn't otherwise own.

**Alternatives considered:**
- *Keep inline in `BookHeroActionBar`*: rejected — already at ~80 LoC and growing 5×.
- *Put in `book-library` feature*: rejected — the progress concept is unit-generic; we want to reuse for non-book unit types later.

### D2. Transition rules as a pure function

```ts
// models/transition.ts
type ShelfOp = { kind: "add" | "remove"; shelfKey: SystemShelfKindKey };

const MIRRORED: SystemShelfKindKey[] = ["backlog", "active"];
const ADD_ONLY: SystemShelfKindKey[] = ["completed"];

export function planTransition(
  from: UserUnitProgressStatus | null,
  to: UserUnitProgressStatus,
): ShelfOp[] {
  const ops: ShelfOp[] = [];
  // Remove from the "from" mirrored shelf (if from is mirrored)
  if (from && from !== to) {
    const fromKey = mirroredKeyOf(from); // BACKLOG → "backlog", ACTIVE → "active", else null
    if (fromKey) ops.push({ kind: "remove", shelfKey: fromKey });
  }
  // Add to the "to" shelf (if to is mirrored or add-only)
  const toKey = mirroredKeyOf(to) ?? addOnlyKeyOf(to); // COMPLETED → "completed"
  if (toKey) ops.push({ kind: "add", shelfKey: toKey });
  return ops;
}
```

Same-status clicks return `[]` (no shelf ops; the modal handles the data edit). The function is pure — fully testable with `bun test`.

**Alternatives considered:**
- *Switch on `to` only (compute ops from current shelf membership at runtime)*: rejected — couples to network reads and complicates dry-run/optimistic UI.
- *Encode rules in a giant table in JSX/components*: rejected — the rules are the contract; they belong in a typed module with tests.

### D3. `ProgressExtra` schema and reason-post array semantics

```ts
// contract: package/contract/src/progress.ts
export const progressExtraSchema = t.Object(
  {
    paused:  t.Optional(t.Object({ reasonPostUnitIds: t.Array(t.String()) })),
    dropped: t.Optional(t.Object({ reasonPostUnitIds: t.Array(t.String()) })),
  },
  { additionalProperties: false },
);
```

Replaces the existing `t.Record(t.String(), t.Any())` for `extra` in `unitProgressUpsertBodySchema` and `unitProgressRowDTOSchema`.

**Array order:** append-only, oldest first. UI renders reverse — newest at the top. Ordering is a fixed contract; rotating order would invalidate every historical client.

**Save action defaults (modal):**
- Empty array → "Save" creates a new post and writes `extra.{paused|dropped} = { reasonPostUnitIds: [postId] }`.
- Non-empty array → "Save" loads the **latest** post body for editing and calls `PATCH /post/<id>` on confirm; the array is unchanged.
- An explicit "新增" (Add new) action always creates a new post and appends its id.

**Read tolerance:** rows with `extra = null`, `extra = {}`, or unknown keys are treated as "no reason history". The server validates writes but is lenient on existing reads (no migration needed).

**Alternatives considered:**
- *Single post id per status (`reasonPostUnitId`)*: rejected — user explicitly chose history-preserving array.
- *Append-only with no in-place edit*: rejected — would generate excessive post rows for users who tweak the latest reason.

### D4. Reason post creation contract

- `kindKey: "post"` (existing valid value; no new kind needed).
- `targetUnitId`: the unit being shelved/dropped.
- `authorUserId`: the calling user.
- `body`: the textarea content (markdown supported by `markdown-post-content`).
- `visibility`: defaults `PUBLIC`; the modal exposes a private toggle that maps to `UNLISTED` (per existing `UnitVisibility` enum).
- The post is created via the existing `POST /post` endpoint — no new API.

### D5. System-shelf id resolution on the frontend

System shelves live keyed by `User.extra.shelves[kindKey] → unitId`. The frontend needs the four unitIds to call `collectionApi.collect / shelfApi.removeItem`.

**Choice:** extend the existing `GET /user/me` response to include a `systemShelves: { favorites, backlog, active, completed }` map. Hydrated by the existing lazy-create path on the server (`getOrCreateSystemShelf`) for each system key on first read.

**Alternatives considered:**
- *New `GET /me/system-shelves` endpoint*: rejected — adds a route for one map; `me` is already the natural carrier for user metadata.
- *Frontend reads `user.extra` directly*: rejected — `extra` is currently not surfaced in the DTO and we don't want to expose the whole field as a side door.

This is a small additive change to the user DTO contract.

### D6. Dual-write orchestration and partial-failure UX

`useStatusTransition()` exposes `transition({ to, ...modalPayload })`:

1. Compute `ShelfOp[]` from `planTransition(from, to)`.
2. Issue **two parallel mutations**:
   - `PUT /me/units/:unitId/progress` with the new status / progress / lastPosition / extra.
   - For each `ShelfOp`, `POST /shelf/:shelfId/items` (add) or `DELETE /shelf/:shelfId/items/:itemRef` (remove).
3. Use `Promise.allSettled`; on any rejection, surface a toast with action-specific copy and a `Retry` button that re-issues only the failed half.
4. On success, invalidate `progressKeys.detail(unitId)`, `collectionKeys.status(unitId)`, and the affected shelves' item lists.

Optimistic UI: only the toggle-group selection updates optimistically; the `+1` increment in `CompletedConfirmModal` is also optimistic but rolls back if the progress write rejects.

**Why parallel, not serial:** the spec explicitly tolerates partial failure and doesn't require ordering. Parallel halves the perceived latency.

### D7. `+1` choreography for `COMPLETED`

```
t=0     modal opens; main number = currentCount; "+1" badge shown in brand color
t=click confirm pressed; PUT progress kicks off (optimistic)
t=120ms main number animates currentCount → currentCount+1 (220ms ease)
t=180ms "+1" badge fades to 0 (160ms)
t=380ms modal close (150ms exit)
```

If the `PUT` rejects, the count snaps back and an error toast shows. The shelf side-effect runs in parallel and does not block the animation.

### D8. Same-status click semantics

| Current | Click | Behavior |
|---------|-------|----------|
| `BACKLOG` | 想讀 | open remove confirmation; confirm soft-deletes progress and removes the backlog shelf item |
| `ACTIVE` | 在讀 | open `ActiveProgressModal` to edit progress / lastPosition |
| `PAUSED` | 擱置 (overflow) | open `ReasonModal` (paused variant) on the existing array |
| `DROPPED` | 棄 | open `ReasonModal` (dropped variant) on the existing array |
| `COMPLETED` | 已讀 | open `CompletedConfirmModal`; confirm = `completedCount += 1` (re-read) |

This means every selected status has an explicit second-click affordance. `BACKLOG` is the lightweight opt-out path, but it uses a confirmation because it hides the progress row and removes the mirrored shelf item. The `+1` re-read path is the natural way to log multiple completions.

### D9. Overflow menu placement for `DROPPED` and "Remove progress"

`PAUSED` and `DROPPED` are less frequent and reason-driven, so keep the primary row compact. Place a `⋯` overflow `DropdownMenu` as the fourth slot in the segmented control:

```
[想讀] [在讀] [已讀] [⋯]
                      ├─ 擱置 (PAUSED)
                      ├─ 棄 (DROPPED)
                      └─ 移除進度 (DELETE /me/units/:id/progress)
```

"Remove progress" calls the existing `DELETE` endpoint, whose implementation is a soft delete on `UserUnitProgress`. It is shelf-aware: it issues a `remove` op against whichever mirrored shelf currently owns the unit (`backlog` or `active`), and **leaves `completed` untouched** (add-only).

### D10. `lastPosition` / chapter picker

- `useChapterPicker(bookUnitId)` hydrates `BookContentStructure.nodes` from the existing book API.
- `ChapterPicker` flattens nested chapters into a Combobox with hierarchical labels (`Vol 1 > Chapter 5: The Storm`).
- Selecting a chapter writes a `chapterLastPosition` (`{ kind: "chapter", chapterUnitId }`) — the simpler of the two `unitLastPositionSchema` shapes is sufficient for v2.
- `contentStructurePathLastPosition` is reserved for the in-app reader and not surfaced in this modal.

## Risks / Trade-offs

- **[Risk] `User.me` DTO change ripples**: extending `mapUserToDTO` to include `systemShelves` touches every consumer that types-checks the response. **Mitigation:** make the field optional on the DTO and lazy-populate (server may return `undefined` if the user predates the extra-shelves bootstrap; frontend lazy-creates on first transition by calling the existing service path or issuing a server-side trigger).
- **[Risk] Reason-post visibility default `PUBLIC`** could surprise users who dump candid text. **Mitigation:** the modal shows the visibility toggle prominently with a hint; we do not silently change it post-hoc.
- **[Risk] Partial-failure toast spam** on flaky networks could annoy. **Mitigation:** debounce identical retries; one toast per `(unitId, op)` until dismissed.
- **[Risk] Optimistic toggle desyncs** with stale server state if multiple devices write simultaneously. **Mitigation:** the existing `lastSeenAt`-based invalidation and the underlying last-write-wins semantics from `user-unit-progress/spec.md` already handle concurrent writes; we trust the server's resolution and reconcile on next fetch.
- **[Trade-off] Edit-in-place reason posts** silently revise a public post body. We accept this — it matches normal post editing and avoids orphaned-post pollution. Users who want history can always click "新增".
- **[Trade-off] No backend reconciliation** means the two stores can drift if a client only ever completes one half (e.g., progress write succeeds, browser crashes before shelf write). The spec tolerates this; aggregate analytics use the Meilisearch projection of progress, not shelf membership.

## Migration Plan

This is a frontend-led change with a contract tightening; no DB migration is required.

1. **Contract**: tighten `progressExtraSchema` and re-export. Existing rows with `extra = null` or unknown shapes remain readable (the runtime parser is lenient on read, strict on write).
2. **Server**: validate `extra` payloads on `PUT /me/units/:unitId/progress` against the new schema. Reject unrecognized top-level keys with a 400.
3. **User DTO**: add optional `systemShelves` to `UserDTO`; populate via `getOrCreateSystemShelf` (existing).
4. **Frontend**: build the `progress-status` feature; replace the inlined section in `BookHeroActionBar`. Delete the old `completeDialogOpen` state and number input.
5. **Rollout**: ship in one PR. No flag — the contract narrowing is forward-compatible with existing rows, and the UI swap is surgical.
6. **Rollback**: revert the PR. `extra` accepts the old wide shape again on read; in-flight writes from the new client would have been narrow-shape JSON which is also valid under the old wide schema.

## Open Questions

- Should "Remove progress" require a confirm? (Default: no, given idempotent delete; add a tiny confirm if user feedback shows accidental clicks.)
- Visibility default — `PUBLIC` per user direction; revisit if community feedback suggests it leaks too much.
- Do we want a dedicated "paused/dropped count" surface anywhere (e.g., profile)? Out of scope for v2; the data is there if we choose to.
