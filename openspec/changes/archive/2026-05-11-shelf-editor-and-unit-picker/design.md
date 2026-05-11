## Context

### Current state

- **Shelf edit page** (`package/app/src/shelf/pages/ShelfEditPage.tsx`)
  has fields for `title`, `description`, `coverUrl` only. Save calls
  `useUpdateShelfMutation` and navigates back to the shelf view. No item
  CRUD is exposed.
- **Item API surface** is already complete on the server:
  - `POST /shelf/:id/items` — add
  - `PATCH /shelf/:id/items/:ref/position` — reorder via
    `{ beforeItemRef?, afterItemRef? }`
  - `DELETE /shelf/:id/items/:ref` — remove
  - `PUT /shelf/:id/items/:ref/tags`, attach/detach review endpoints
  - `GET /shelf/:id/items?cursor&limit` — cursor-paginated list
- `ShelfItem.position` is a base-62 fractional index string
  (`package/server/src/shelf/fractional-index.ts`). A mirror implementation
  exists on the client at `package/api/src/tag/fractional-index.ts` with an
  explicit comment that the two sides agree on lexicographic order.
- **`ExcerptSourcePicker`** uses `parseAppRoute()` to extract a single
  `unitId` from a pasted URL. The parser walks segments naively and returns
  `segments[1]`, dropping any deeper unit identifier. It also includes a
  `TreeDisclosure` that lists sub-units of a known `targetUnitId`.
- **TanStack Router** v1.168 exposes `router.getMatchedRoutes(pathname)` on
  the router instance. The signature in `@tanstack/router-core` returns
  `{ matchedRoutes, routeParams, parsedParams, foundRoute, parseError }` —
  a full route match chain plus exhaustive params keyed by their declared
  param names.
- **Shelf `viewMode`** lives in `extra.viewMode` and is one of
  `"flat" | "nested" | "masonry"` (default `"nested"`). The `ShelfItemRenderer`
  already branches on it: nested mode wraps attached reviews in a `Tabs`
  preview inside the parent card.

### Constraints

- Owner-only editing. The user model has a single owner per shelf; concurrent
  multi-user editing is not a supported user-facing flow.
- The project is in active development (per `CLAUDE.md`), so backward-compatible
  shims for internal renames are forbidden unless an OpenSpec change grants
  an exception.
- Feature layering rule: `models/` must not depend on `hooks/` or `states/`,
  and external consumers go through the feature's `index.ts`.

## Goals / Non-Goals

**Goals**

- Make shelf curation possible inside the edit page (add / reorder / delete
  items, attach reviews and tags) without leaving for the collect modal.
- Share URL-to-unit candidate resolution between excerpt and shelf via a
  single component so the multi-`unitId` URL bug is fixed in one place.
- Keep server writes cheap: frontend pre-computes fractional positions so
  reorders are O(1) on the wire and O(log n) on the index.
- Preserve the existing metadata form layout and Save semantics; only the
  post-save navigation is loosened so the user can continue editing items
  in the same session.
- Honor the shelf's `viewMode` in the editor (attached children get their
  own rows in flat mode, render as in-card tabs without controls in nested
  mode).

**Non-Goals**

- Live collaborative editing of a single shelf.
- Rich bulk paste (multi-line URL paste) in the picker — v1 is single line.
- Drag-reorder under non-position sort modes (sort by title, date, etc.).
- Virtualization of the items list — pagination already handles size; we
  load only the current page into the DOM.
- A unified Save covering both metadata and items together — two saves are
  intentional (independent failure modes, simpler dirty model per section).
- Backfilling existing client code that resolves URLs through ad-hoc
  segment splitting (`parseAppRoute`) — that helper is deleted, callers
  migrate.

## Decisions

### 1. URL parser uses `router.getMatchedRoutes(pathname)`

We replace the segment-splitting `parseAppRoute()` with a function that calls
`router.getMatchedRoutes(pathname)` and walks `matchedRoutes` collecting every
param whose name ends in `Id` or `Slug`. Result ordering is from outer to
inner; we reverse so the deepest (most specific) candidate appears first.

```
input        : "https://app.example/book/abc/read/xyz"
pathname     : "/book/abc/read/xyz"
matchedRoutes: [ root, _mainLayout, book/$bookId, book/$bookId/read/$chapterId ]
routeParams  : { bookId: "abc", chapterId: "xyz" }
candidates   : [
  { kind: "chapter", identifier: "xyz", type: "id" },  // deepest first
  { kind: "book",    identifier: "abc", type: "id" },
]
```

`kind` is derived from the param name by stripping `Id` / `Slug` suffix
(`bookId → book`, `unitSlug → unit`). The generic `unit` kind requires a
follow-up fetch to resolve the actual underlying kind for display.

**Alternatives considered**

- Pattern table of multi-id URLs — precise but couples spec to router file
  layout; every route addition needs a parallel table edit.
- Backend `/parse-url` resolver — single source of truth, but adds a round
  trip to a UI-critical path.
- Continue with heuristic segment walking — rejected; same kind of fragility
  that produced the original bug.

The router-match approach reuses TanStack Router's existing match graph and
needs zero parallel data structures. The only convention we depend on is
that unit-bearing params are named `${kind}Id` or `${kind}Slug`, which is
already the project's pattern.

### 2. `UnitPicker` is a single component with a render-prop action slot

The shelf editor and excerpt source picker need the same parse → candidates
pipeline but different actions on each candidate row (excerpt = "Use this",
shelf = "Add"). We expose one component:

```ts
<UnitPicker
  workContextUnitId={book?.unitId}        // optional: enable sub-unit browsing
  language={lang}
  initialInput={preset?}                  // optional preset URL
  renderItemAction={(candidate) => ReactNode}
/>
```

The picker owns its input state and renders both:

1. **Parse panel** — input + candidates list (driven by `router.getMatchedRoutes`).
2. **Browse panel** — collapsed disclosure listing the sub-units of
   `workContextUnitId` (the existing `TreeDisclosure` flow, lifted into the
   picker).

`renderItemAction` is a function from `Candidate → ReactNode` so each shell
decides its own button label and click behavior. Headless state lives in a
hook `useUnitCandidates(input)` for shells that want full control, but the
component is the recommended path.

**Alternatives considered**

- Two separate components sharing internals — duplicates the input/disclosure
  wrapping for no benefit.
- `mode: "single" | "multi"` prop — fewer escape hatches; the render-prop
  form is more flexible without extra branches in the picker.

### 3. New `unit` feature folder owns the picker

The picker crosses the existing `shelf` and `excerpt` features and needs to
own its own model layer (URL parsing) and hooks. Per the feature standard,
it gets its own feature directory:

```
package/app/src/unit/
├── index.ts                        # only public surface
├── models/
│   ├── parseUrlToUnitCandidates.ts # pure: (getMatchedRoutes, input) → Candidate[]
│   ├── parseUrlToUnitCandidates.test.ts
│   ├── unitParamKind.ts            # param-name → kind map
│   └── types.ts                    # Candidate, IdentifierType, …
├── hooks/
│   └── useUnitCandidates.ts        # injects useRouter, fetches unit details
└── components/
    └── UnitPicker/
        ├── UnitPicker.tsx
        ├── UnitPicker.stories.tsx
        └── UnitCandidateRow.tsx
```

`models/` depends only on the `getMatchedRoutes` function signature, not on
`useRouter` — so it is pure and testable. `hooks/useUnitCandidates` wires the
router instance and adds React Query for unit metadata lookup. `index.ts`
exports only `UnitPicker`, `useUnitCandidates`, and the `Candidate` type.

### 4. Frontend computes positions; server persists strings

Reorder and add operations compute their target `position` string on the
client using the existing fractional-index algorithm. The current per-op
`PATCH .../position` endpoint takes `{ beforeItemRef, afterItemRef }` and
recomputes server-side; the new batch endpoint takes `position` directly
because the client has already calculated it from the in-memory model.

Promoting `fractional-index.ts` to a shared location avoids reimplementation:

- Move `package/api/src/tag/fractional-index.ts` to
  `package/api/src/shared/fractional-index.ts` and re-export from `tag/`
  and the new `shelf/` editor consumer.
- The server-side `package/server/src/shelf/fractional-index.ts` stays —
  it is still used by per-op endpoints and by collection insertions.

### 5. Op log + batch save endpoint

Item edits accumulate as an in-memory op log in the editor's local state:

```ts
type ShelfItemOp =
  | { op: "add";      itemRef: string; kind: ShelfItemKind; position: string; tagIds?: string[]; reviewIds?: string[] }
  | { op: "reorder";  itemRef: string; position: string }
  | { op: "delete";   itemRef: string }
  | { op: "setTags";  itemRef: string; tagIds: string[] };
```

Save POSTs the whole list to `PATCH /shelf/:id/items/batch`. The server
applies ops inside one transaction and returns per-op outcomes:

```ts
type BatchResponse = {
  results: Array<
    | { status: "ok"; op: ShelfItemOp; item?: ShelfItemDTO }
    | { status: "failed"; op: ShelfItemOp; reason: string }
  >;
};
```

Individual op failures (e.g. reorder targeting a deleted item) do not roll
back the whole transaction — the server applies what it can in order and
records misses. The client keeps failed ops in the dirty log and surfaces a
retry control showing the failure reasons inline.

**Local op coalescing** — the editor collapses obvious redundancies before
sending: `add X → delete X` cancels both; multiple reorders of the same item
keep only the final position; `add X → reorder X` becomes one `add` with
the final position. Coalescing is best-effort UX hygiene, not a correctness
requirement; the server tolerates redundant ops.

**Alternatives considered**

- Send the full desired list instead of an op log — simpler to reason about,
  but big shelves push thousands of items per save and lose information
  about user intent. Op log keeps payload proportional to actual changes.
- One mutation per UI action (auto-save) — viable since each write is cheap,
  but loses the "experiment then commit" UX of a curation workflow and adds
  request chatter.

### 6. Pagination + reorder

Items list paginates server-side with the existing cursor query. Drag-and-drop
is restricted to items within the currently rendered page; computing a new
position uses the neighbors already in the DOM.

For cross-page moves we add a `MoveRight` icon button per row that opens a
modal listing all pages (numbered 1..N). Selecting page K moves the item to
**the first position of page K**, computed server-side because the client
does not have page K's items in memory. The endpoint accepts an `edge`
variant of the op:

```ts
{ op: "reorder"; itemRef: string; toPage: number; edge: "first" }
```

The server fetches the first item of page K to obtain its position string,
computes the new position via `keyBefore(firstPosition)`, and persists.
Once the user navigates to page K, a normal in-page drag refines placement.

`Sort` selector remains on the items panel. Reorder controls (drag handle,
MoveRight) render only when `sort = position`. Other sort modes hide the
drag handle but keep the delete button — sorting view is independent of
edit ability for non-reorder ops.

### 7. `viewMode` honored in the editor

The editor enumerates entries through the same `shelfStream` model used by
the view page so flattening behavior matches:

- `flat`: every primary item *and* every attached `role=review` /
  `role=tag` unit emits an entry row. Every row gets a control column.
- `nested`: only primary items emit entries; attached reviews/tags appear
  as `Tabs` inside the parent card and inherit `NestedPrimeCard`'s preview
  treatment — they have no control column.
- `masonry`: out of scope for this change; treated as a styling alternative
  to `flat` (every entry gets a card; control column policy unchanged).

This means in flat mode, a user can reorder an attached review independently
of its parent shelf item — consistent with the dropped "children only sort
internally" restriction.

### 8. Two independent Save buttons

Metadata Save and Items Save are separate widgets and post to different
endpoints. They share a leave-prompt: if either area is dirty, route exit
prompts confirmation.

- Metadata Save target: existing `PATCH /shelf/:id` (unchanged).
- Items Save target: new `PATCH /shelf/:id/items/batch`.
- Metadata Save no longer navigates after success — the existing
  `onSuccess: navigate(...)` is removed so users can continue editing items.
  This is the only behavioral change to the metadata area; layout is
  untouched.
- Each Save's failure mode is local to its section; partial success of the
  items batch keeps the failed ops in dirty state with their reasons.

### 9. Server batch handler

`POST /shelf/:id/items/batch` (PATCH semantically; the path may use PATCH
verb) runs inside one `prisma.$transaction`. Ordering of ops is preserved.
Each op result records `ok` or `failed { reason }`. Authentication and
ownership are checked once before applying ops.

The batch handler is additive — single-op routes remain available for
external callers and the collect flow. Internal editor traffic uses the
batch endpoint exclusively.

## Risks / Trade-offs

- **Position string conflicts on collect during edit** → ops are append-only
  in terms of position space (collect picks `keyAfter(last)`); client-computed
  reorders within an existing range do not collide with new appends because
  the new position falls outside the user's edit range. If a true collision
  occurs (extremely unlikely given the base-62 keyspace), the server's
  `UPDATE` still succeeds and the duplicate position is acceptable —
  fractional indexing tolerates equal keys; only deterministic ordering of
  the tied pair degrades to insertion order.
- **Cross-page move accuracy** → moving to a different page does not pick a
  specific slot, only the first position of the destination page. This is
  intentional (one-step UX) but can surprise users expecting fine placement
  across pages. Mitigation: docs / hint copy in the modal ("Will land at
  top of page K. Drag to fine-tune after navigating.").
- **Drag interaction under non-position sort** → drag handles are simply
  hidden; the sort selector itself stays accessible. Users who want to
  reorder must switch to `position` sort first. Mitigation: a small hint
  near the sort selector when drag is unavailable.
- **`getMatchedRoutes` returning `parseError`** → URL pasting is
  user-driven, so junk input is normal. The picker surfaces parse errors as
  a soft message ("Couldn't recognize this as a unit link") and falls back
  to the browse panel.
- **Slug-only candidates** → if a route only carries a `unitSlug`, the
  picker fetches by slug before showing a kind / title. The existing API
  has a slug lookup (`unit-slug` capability); we wire it through the new
  hook.
- **`parseAppRoute` deletion blast radius** → it is currently imported only
  by `ExcerptSourcePicker`. Migration is scoped; we remove the file in the
  same change to avoid stale imports per the development-stage policy.
- **Items list state during save** → optimistic updates render the
  post-save state immediately on each user op. If the batch save fails for
  some ops, those rows revert (deletes restore, adds disappear) and a
  retry chip appears. Coalescing happens before send to minimize the rows
  that need reverting on failure.

## Migration Plan

1. Land server batch endpoint behind the same auth as existing per-op
   routes. No schema migration. Add API client wrapper + mutation hook.
2. Move `fractional-index.ts` to `package/api/src/shared/` and update tag
   imports in the same diff so the tree compiles. Shelf editor consumes it
   from the new shared path.
3. Land `unit` feature (parser, hook, `UnitPicker`, storybook). No callers
   change yet; the feature is self-contained.
4. Switch `ExcerptSourcePicker` over to `UnitPicker`; delete
   `parse-app-route.ts` and its tests.
5. Add items section to `ShelfEditPage` consuming `UnitPicker`, the
   reorder-aware list, and the batch mutation. Remove the
   `onSuccess: navigate(...)` from the existing metadata Save.
6. Storybook coverage for `UnitPicker` (single-select, multi-add, parse
   errors, browse panel) and for the items list (manual sort, alternative
   sort, dirty footer, partial save failure).

No rollback strategy is needed beyond standard revert — the change is
additive on the server and replaces dead UI on the client.

## Open Questions

- Are there `MoveRight` alternatives that read better in the Apple-inspired
  design language? `MoveRight` is a directional arrow; an explicit
  `FolderInput` / `PageMove` glyph might communicate "move to other page"
  more clearly. Reserved for design pass during implementation.
- Should the cross-page modal expose page previews (first item's title)
  next to each page number for orientation, or is a numeric list enough?
  Default is numeric list; preview is a stretch enhancement.
- Should the batch endpoint enforce a max op count (e.g. 200) to bound
  transaction time? Probably yes — set a server-side cap and have the
  client split if exceeded. Cap value to be set during implementation.
