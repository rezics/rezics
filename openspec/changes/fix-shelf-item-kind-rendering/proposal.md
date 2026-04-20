## Why

`ShelfPage` currently renders every item as a generic placeholder that shows only a `kind` chip and a title string, falling back to the raw `itemRef` (unitId) whenever title resolution fails. Books look un-covered, reviews show no content, and all non-`book`/`post`/`tag` kinds show their unitId. The underlying batch hydration in `useShelfHydration` already fetches full DTOs and seeds them into per-domain detail caches — the render path simply ignores that data and reads fields that do not exist on the returned DTOs (`translations[0].title` on `PostDTO`, `label` on `UnitTagDTO`). The spec at `shelf-batch-hydration` already calls for attachment hydration and generic fallback; the implementation does neither.

## What Changes

- Rewrite `ShelfItemRenderer` to dispatch by `kind` to existing domain cards, reading the full hydrated DTO straight from the TanStack Query detail cache via `queryClient.getQueryData`:
  - `book` → `BookCard` with `coverUrl`, title, author from `BookDTO`.
  - `review` → `ReviewCard` with the `PostDTO`.
  - `quote` → `ExcerptCard` with the `PostDTO`.
  - `post` → `PostCard` with the `PostDTO`.
  - `tag` → `SingleTagChip` with the tag DTO.
  - Unsupported kinds (`chapter`, `realm`, `image`, `video`, `media`, `game`, `link`) render a minimal generic shell (kind chip + short `itemRef`) without issuing any request.
- Render attached `reviewIds` under each primary item using `ReviewCard` fed from the same post cache.
- Extend `useShelfHydration` to fold each item's `reviewIds` into the `/post/list` batch and `tagIds` into the `/tag/list` batch (per the existing but unimplemented `shelf-batch-hydration` requirement).
- Tighten `useShelfHydration`'s bucket return type from `Array<{ unitId: string }>` to the real per-bucket DTO arrays so the compiler catches future shape drift.
- Delete `ShelfPage.getHydratedTitle` and its `title` prop plumbing; introduce a small pure `titleOf(item, cached)` helper used **only** for title-mode sorting — separate from rendering.
- Shrink `ShelfItemCard` to a generic unsupported-kind fallback (kind chip + `itemRef`); all supported kinds no longer touch it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shelf-batch-hydration`: add a kind-dispatched rendering requirement that binds each supported `kind` to a concrete domain card fed the full hydrated DTO, and a separate "title derivation is sort-only" requirement. The existing attachment-hydration requirement is unchanged in wording but gains explicit scenarios covering `reviewIds` folding into the post batch and rendering attached reviews below the primary item.

## Impact

- **Affected packages**
  - `package/api` — `src/shelf/useShelfHydration.ts` (fold attachments; typed buckets).
  - `package/app` — `src/shelf/components/ShelfItemRenderer.tsx` (kind dispatch), `src/shelf/components/ShelfItemCard.tsx` (shrink to generic fallback), `src/shelf/pages/ShelfPage.tsx` (remove `getHydratedTitle`, add `titleOf` sort helper, thread cached-DTO reads).
- **APIs**: no backend or contract changes. `/book/list`, `/post/list`, `/tag/list` already honor `ids` and return the required shapes. `/unit/list` is admin-only and is intentionally **not** used for the generic fallback — unsupported kinds render without a network request.
- **Backward compatibility**: no storage or wire-format change. Query keys and cache seeding remain identical. Shelves that only contain `book`/`review`/`post`/`quote`/`tag` items now display correctly where they previously showed `kind` + `itemRef`.
- **Migration**: none required. Change is frontend-only.
