## Why

The current shelf view toggle `grid | list | review` conflates two orthogonal concerns — how reviews are attached to their prime item, and how items are laid out on the page — into a single flat enum. This produces a mental model users and future contributors cannot reason about: "grid" is actually a planned masonry/waterfall (still mocked), "list" is already a flat mode where reviews are siblings of their prime, and "review" (which is actually the conceptual default) is the only mode where reviews are bundled with the prime as tabs.

Sorting has the same leak: when a user sorts by title, reviews currently compete with primes on the same field, which is almost never what the user wants. The shelf's primary ordering axis is prime items; reviews ride along. Today this is unreachable and non-toggleable.

## What Changes

- **BREAKING** Rename the `ShelfView` enum values from `"grid" | "list" | "review"` to `"nested" | "flat" | "masonry"`.
  - `nested` (new, = old `review`): each shelf item renders as a single card; attached reviews appear as tabs inside that card. **New default**.
  - `flat` (renames `list`): primes and their attached reviews are emitted as independent sibling entries in a row-layout stream.
  - `masonry` (renames/replaces `grid`): same item stream as `flat`, laid out as a masonry/waterfall grid. The masonry layout itself remains **MOCK** until the real masonry primitive lands.
- Add a sort-scope toggle `sortPrimeOnly: boolean` (default `true`). When `true`, only shelf items whose role is `primary` participate in the sort comparator; attached reviews (and future non-primary roles) stay adjacent to their prime in the emitted stream. When `false`, every emitted entry — primes and reviews alike — participates in the sort comparator as a peer.
- Expose the sort-scope toggle in the UI only when the current mode is `flat` or `masonry` AND the current sort is not `manual` (in `nested` mode reviews are tabs, so the toggle has no effect; under `manual` ordering nothing sorts).
- Persist the new view-mode value on `shelf.extra.viewMode` using the new string set; read path tolerates legacy values by mapping `review → nested`, `list → flat`, `grid → masonry`.

## Capabilities

### New Capabilities
- `shelf-display-modes`: governs the shelf-detail frontend's view-mode enum, sort-scope toggle, the item-stream emission rule for each mode, the persistence shape on `shelf.extra`, and the legacy-value read-path tolerance.

### Modified Capabilities
<!-- none — no existing capability's requirements change; this is a new frontend-facing capability. -->

## Impact

- Affected packages:
  - `package/api` — `ShelfView` type in `shelf.types.ts`, any query options that echo the enum.
  - `package/app` — `ShelfPage.tsx` view/sort state, `ShelfItemRenderer.tsx` branching on `viewMode`, item-stream derivation (new), UI labels/icons on the toggle group, and the new sort-scope control.
  - `package/server` — no schema or route change; server stores `shelf.extra` as an opaque JSON blob today.
  - `package/contract` — only if any Typebox schema enumerates `ShelfView`; check and update if so.
- Backward compatibility: persisted `shelf.extra.viewMode` values written by the old UI (`"grid" | "list" | "review"`) are accepted on read via a one-way mapping into the new enum. No data migration is required. On next write, the new values replace the old ones.
- Mock surface: the masonry layout primitive stays mocked with a `// MOCK:` annotation; the enum and emission rules are real.
