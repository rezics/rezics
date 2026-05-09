## Why

The current `UserUnitProgress` interaction in `BookHeroActionBar.tsx` is a thin v1 prototype: a 4-button toggle group plus a numeric-input "completed count" dialog. It misses the `DROPPED` status entirely, has no reason capture for `PAUSED`/`DROPPED`, performs zero shelf membership writes, and uses an arbitrary number input rather than the per-click `+1` reading-count UX the product wants. As reading flow becomes the primary engagement surface, the status control needs to become a real, modal-driven feature with reason posts, system-shelf side effects, and a proper reading-progress editor.

## What Changes

- Extract `UserUnitProgressStatus` UI from `BookHeroActionBar` into a new `progress-status` feature folder under `package/app/src/`, following the standard feature layout (`models/`, `hooks/`, `states/`, `components/`, `sections/`, `index.ts`).
- Add `DROPPED` to the user-facing status control via an overflow menu (alongside "remove progress"); the four primary toggle slots remain `BACKLOG` / `ACTIVE` / `PAUSED` / `COMPLETED`.
- Per-status modal flows:
  - `BACKLOG` (想讀): no modal — direct write.
  - `ACTIVE` (在讀): modal with progress slider (1% granularity) and a chapter picker fed by `BookContentStructure.nodes`.
  - `PAUSED` (擱置) / `DROPPED` (棄): modal with optional reason post; default save edits the latest bound post in place, an explicit "新增" button appends a new post to the per-status array. Skip is allowed.
  - `COMPLETED` (已讀): confirm modal showing previous `completedCount` with a brand-color `+1` preview; on confirm, the main number animates `n → n+1`, the `+1` symbol fades, then the modal closes (≈220ms ease).
- Click on already-current status:
  - `BACKLOG → BACKLOG`: no-op.
  - `ACTIVE → ACTIVE`: re-open modal to edit progress / lastPosition.
  - `PAUSED → PAUSED` / `DROPPED → DROPPED`: re-open modal to edit reason.
  - `COMPLETED → COMPLETED`: re-open `+1` confirm to log a re-read; cancellable.
- Frontend-driven dual-write to system shelves via the existing shelf API. Backend remains decoupled per the existing `user-unit-progress` orthogonality requirement.
  - `backlog` and `active` shelves mirror status (move semantics: remove from previous, add to new).
  - `completed` shelf is **add-only** — never removed when leaving `COMPLETED` (re-reading still shows the unit in `completed`).
  - `PAUSED` and `DROPPED` are **not** members of any system shelf.
  - On partial failure (progress ok / shelf failed, or vice versa) a toast surfaces the error with retry; both stores remain independently consistent.
- Tighten `UserUnitProgress.extra` from `Record<string, any>` to a narrow per-status domain schema: `{ paused?: { reasonPostUnitIds: string[] }, dropped?: { reasonPostUnitIds: string[] } }`. Reason posts are appended over time; UI renders newest first.
- Reason posts use `kindKey: "post"`, `targetUnitId = <shelved unit>`, default `visibility: PUBLIC` (modal toggleable to private).

## Capabilities

### New Capabilities
- `progress-status-ui`: Frontend status-control feature, modal flows, dual-write orchestration, optimistic `+1` choreography, partial-failure toasts, and the `progress-status` feature-folder structure.

### Modified Capabilities
- `user-unit-progress`: Narrow `UserUnitProgress.extra` to a per-status `ProgressExtra` schema; document the frontend dual-write rules for system-shelf membership (move semantics for `backlog`/`active`, add-only for `completed`, none for `paused`/`dropped`).

## Impact

- **Code**:
  - `package/app/src/progress-status/**` — new feature folder.
  - `package/app/src/book-library/sections/BookHeroActionBar.tsx` — strip inlined status logic, mount the new section.
  - `package/contract/src/progress.ts` — replace the loose `extra` schema with the narrow `ProgressExtra` shape; export validators.
  - `package/api/src/**` — surface the narrowed `extra` type through existing progress hooks; expose helpers for `BookContentStructure` retrieval if not already.
  - `package/server/src/progress/**` — accept and persist the narrowed `extra`; reject `extra` payloads that don't match the per-status domain shape (validation only — no shelf side effects).
- **Specs**: New `progress-status-ui` capability spec; delta to `user-unit-progress` for the `extra` shape and dual-write rules.
- **i18n**: New zh-Hant / en keys for modal copy, overflow menu items, toast messages.
- **No DB migration**: `UserUnitProgress.extra` is already `Json?`; the change is schema-tightening at the contract layer. Existing rows with `extra = null` or unknown shapes are tolerated on read (treated as empty).
- **No backend coupling added**: continues to satisfy the `Progress and shelf are orthogonal stores` requirement in `user-unit-progress/spec.md`.
- **Out of scope**: status UI for non-`BOOK` unit types; reason-post threading/replies; aggregate analytics on reason posts; admin/moderator views of paused-reason history.
