## Context

`package/app/src/shelf/pages/ShelfPage.tsx` today exposes a three-way view toggle `grid | list | review` and a three-way sort toggle `manual | time | title`. The view values travel through the contract as `ShelfView = "grid" | "list" | "review"` (declared in `package/api/src/shelf/shelf.types.ts:49`) and are branched on inside `ShelfItemRenderer.tsx` to choose between vertical card / horizontal row / review-stack layouts. The rendered stream in all non-`review` modes is just `visibleEnriched.map(...)` — one DOM node per `ShelfItem`. In `review` mode the renderer appends each `item.attachedReviews` underneath the primary via a `Stack`, but the items themselves remain atomic: reviews never leave their parent slot.

The semantic bug is that the current `list` mode is visually a flat row list *but* still emits one entry per shelf item — attached reviews disappear unless the user flips to `review` mode. Meanwhile `review` mode stacks reviews underneath the prime — not as tabs, just as vertically-appended cards — and `grid` is an unrelated layout dimension tagged to a different logical mode. In the user's mental model, keeping reviews adjacent to their prime is the **default** behaviour and only the presentation of that adjacency differs: tabs inside one card, sibling rows, or masonry tiles. The current enum cannot express that.

Sorting has a parallel problem. `sortedEnriched` in `ShelfPage.tsx` calls `Array.sort` on `hydration.enriched`, which is a `ShelfItem[]`-shaped array — attached reviews never reach the comparator today because they never leave their parent. The moment we split items into a per-entry stream (for flat / masonry), reviews become peer entries and the comparator would pull them apart from their prime. That is not what users want most of the time, so the spec introduces a `sortPrimeOnly` flag defaulted to `true`, and the UI surfaces the toggle only where it is semantically meaningful (flat / masonry AND non-manual sort).

The frontend-first convention applies: masonry layout stays mocked until the real primitive lands, but the enum value and the stream-emission contract are real.

## Goals / Non-Goals

**Goals:**

- Replace `ShelfView` with `"nested" | "flat" | "masonry"` and make `"nested"` the default.
- Extract the item-stream derivation (shelf items → rendered entries) into a pure function decoupled from React state, so the spec's scenarios are unit-testable.
- Introduce `sortPrimeOnly: boolean` (default `true`) with visibility gated by mode × sort.
- Persist view preference at `shelf.extra.viewMode` using the new literals; read path tolerates legacy values via a one-way map.
- Keep the masonry layout explicitly mocked per the project's `// MOCK:` convention.

**Non-Goals:**

- No backend schema change. `shelf.extra` remains an opaque JSON blob; the server does not care about `viewMode`.
- No data migration. Old `"grid" | "list" | "review"` values stay on disk until the next write overwrites them.
- No change to `ShelfItem`, `ShelfUnit`, hydration batching, or the shelf list/search pages. This change is scoped to the shelf-detail page.
- No change to `ShelfSortMode` values (`manual | time | title`). Sort-mode semantics are unchanged — only the *scope* over which they apply is parameterised.
- Persistence of `sortMode` and `sortPrimeOnly` on `shelf.extra` is **deferred**. For this change both remain in-component state (`useState`). Persistence can follow in a later change if desired.

## Decisions

### Decision 1: Rename `review → nested`, `list → flat`, `grid → masonry`

We considered keeping `review` as a token because the current name encodes that reviews are the first-class attached role. Rejected because it reads as "a mode for reviewing" or "a mode that shows only reviews," both wrong. We considered `card`, `compact`, `bundled`, `tabbed` for the attached-mode name. `nested` won because its antonym is exactly `flat`, making the mental model symmetric: nested = one card wraps its children; flat = all descendants sit as siblings. The third mode `masonry` is a pure layout word and pairs cleanly with `flat` (both operate on the same emitted stream, only the grid container differs).

### Decision 2: `sortPrimeOnly` as the canonical flag name (positive form)

The user explicitly chose `sortPrimeOnly` over alternatives like `sortAttachmentsToo` or `groupReviewsWithPrime`. Rationale: `sortPrimeOnly = true` asserts the inclusion criterion (*primary-role entries participate*), which scales cleanly when future non-primary roles (e.g. `quote` attachments, per the `shelf-unit-junction` spec) are added — they all fall on the "not sorted" side of the flag without renaming it. A negation-framed name like `sortAttachmentsToo` would either need to enumerate roles or get renamed. Default is `true` to preserve the prime-adjacent property users already rely on.

### Decision 3: Extract `deriveShelfStream(items, mode, sort, sortPrimeOnly)` as a pure function

The current sort block is inline in `ShelfPage.tsx` and operates on `EnrichedShelfItem[]`. For flat / masonry we need a per-entry stream, not a per-item array, and the sort comparator needs to know whether to project attached reviews into the comparable set or leave them glued to their prime. Inlining both concerns into `useMemo` would make the scenarios in `specs/shelf-display-modes/spec.md` hard to test and easy to regress.

Proposed signature (in `package/app/src/shelf/models/`):

```ts
export type ShelfStreamEntry =
  | { kind: 'prime'; enriched: EnrichedShelfItem }
  | { kind: 'review'; parentItemRef: string; review: PostDTO };

export function deriveShelfStream(
  enriched: EnrichedShelfItem[],
  mode: ShelfView,
  sort: ShelfSortMode,
  sortPrimeOnly: boolean,
): ShelfStreamEntry[];
```

- In `nested` mode, returns one `prime` entry per item; attached reviews stay on `enriched.attachedReviews` for the renderer to surface as tabs.
- In `flat` / `masonry` mode, expands to `prime` + one `review` entry per attached review.
- Sort: when `sortPrimeOnly = true`, sort primes with the chosen comparator and keep each prime's reviews immediately after it. When `false` and mode is flat/masonry, sort all entries as peers.
- `manual` sort: ignore `sortPrimeOnly`, order by `position`.

The new file sits under `package/app/src/shelf/models/` per the feature-standard rule that models must not import from `hooks` or `states`. The existing `titleOf.ts` moves or is imported here; it is already pure.

### Decision 4: Persist only `viewMode` on `shelf.extra`; keep `sortMode` and `sortPrimeOnly` local

Extending `shelf.extra` to store `sortMode` and `sortPrimeOnly` would require a server-side write path and conflicts with viewer vs. owner ownership of the shelf. Users often want ephemeral sort choices on shelves that aren't theirs. Deferred to a later change.

### Decision 5: Legacy-value tolerance via a one-way read map, no migration

Mapping `review → nested`, `list → flat`, `grid → masonry` on the read path is a 3-line lookup. A data migration would require touching every shelf row in every user's DB, which is disproportionate for a frontend-only rename. Next write overwrites the legacy value naturally.

### Decision 6: Masonry layout stays mocked; enum value is real

Per the project's `// MOCK:` convention and the proposal's statement that the masonry primitive is planned-but-not-yet, the implementation renders masonry as a CSS `column-count` or `grid-auto-rows` approximation behind a `// MOCK:` annotation. The emitted stream from `deriveShelfStream` is already correct, so swapping in a real masonry primitive later is a layout-only change.

### Decision 7: UI control set

```
Toolbar row 1:   [Nested] [Flat] [Masonry]     ← ToggleButtonGroup
Toolbar row 2:   Sort: [Manual] [Time] [Title]
                 [☑ Sort prime only]           ← hidden unless mode ∈ {flat, masonry} ∧ sort ≠ manual
```

Icons on the mode toggle: `ViewAgendaIcon` (nested, single rich card), `ViewListIcon` (flat, rows), `DashboardIcon` or `ViewQuiltIcon` (masonry). Checkbox rather than another toggle button because its state is orthogonal to the mode/sort groups and binary.

## Risks / Trade-offs

- **[Risk]** Users with a persisted `"grid"` preference see their view switch from the old vertical-card-grid to the new masonry mock. → **Mitigation**: the masonry mock uses a multi-column layout that visually resembles the old grid at common viewport widths, so the break is small. Documented in proposal under "Impact / Mock surface."
- **[Risk]** `deriveShelfStream` in flat/masonry mode with `sortPrimeOnly = false` sorts reviews by *their own* title, but reviews use `PostDTO.translations[0].title` — a shape the current `titleOf.ts` does not handle. → **Mitigation**: extend `titleOf` to accept a `ShelfStreamEntry` and switch on `kind`; add a unit test for review title extraction.
- **[Risk]** Scope creep: someone may want `sortPrimeOnly` to persist. → **Mitigation**: Decision 4 calls this out as deferred; the function signature already accepts it as a parameter, so persistence is additive later.
- **[Trade-off]** Extracting `deriveShelfStream` adds a file and a memo hop, but the spec scenarios are now directly testable with `bun test` and the renderer collapses into a dumb `.map`. Net code size is roughly flat.

## Migration Plan

1. Add the new literals and pure derivation function; keep the old `ShelfView` union alongside as an internal legacy type for one commit if useful, then delete.
2. Update `ShelfPage.tsx` to consume `deriveShelfStream`, the new toggle buttons, and the conditional sort-scope checkbox.
3. Update `ShelfItemRenderer.tsx` to accept `ShelfStreamEntry` and render reviews as either tabs (nested) or standalone cards (flat/masonry — via the existing `ReviewCard`).
4. Add read-path mapping for legacy `shelf.extra.viewMode` strings in the same spot where `savedViewMode` is read in `ShelfPage.tsx`.
5. Add unit tests for `deriveShelfStream` covering each scenario in the spec.

Rollback: revert the commit. No schema or data change means no rollback migration is required.

## Open Questions

- Should `deriveShelfStream` expose the prime's attached tags as part of `ShelfStreamEntry`, or keep them on `enriched` for the renderer to read? Current proposal keeps them on `enriched` to avoid duplication; revisit if a future mode renders tags as peer entries.
- Masonry layout primitive: CSS columns (simpler, imperfect balance) vs. JS-driven (packery/react-masonry)? Out of scope here; the enum lands either way.
