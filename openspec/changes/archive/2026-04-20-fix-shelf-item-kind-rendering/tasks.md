## 1. Extend `useShelfHydration` to fold attachments and type its buckets

- [x] 1.1 In `package/api/src/shelf/useShelfHydration.ts`, change `grouped` computation to fold every item's `reviewIds` into the `post` bucket and every item's `tagIds` into the `tag` bucket in addition to the primary `itemRef`. De-dupe ids inside each bucket before issuing the list call.
- [x] 1.2 Replace the `BucketResult.data?: Array<{ unitId: string }>` field with a discriminated bucket result keyed on bucket name carrying the real DTO arrays (`BookDTO[]`, `PostDTO[]` including the server's `mapPostToDTO` shape, and the actual tag list DTO returned by `mapTagUnitToDTO`). Update `fetchBucket` and `seedCache` signatures accordingly.
- [x] 1.3 Confirm `seedCache` continues to seed `bookKeys.detail(id) / postKeys.detail(id) / tagKeys.detail(id)` with the full DTO for every entry returned — including ids that originated from `reviewIds` / `tagIds` attachments.
- [x] 1.4 Keep orphan detection scoped to primary `itemRef`s only. Attached `reviewIds` / `tagIds` that fail to come back SHALL NOT contribute to `orphanItemRefs`.
- [x] 1.5 Run `bun tsc --noEmit` in `package/api`; resolve any type fallout from the new bucket shape.

## 2. Add the sort-only title helper

- [x] 2.1 Create `package/app/src/shelf/pages/titleOf.ts` exporting `titleOf(item: ShelfItemDTO, cached: unknown): string` per Decision 4 in `design.md`. Implement the four branches (`book`, `review/quote/post`, `tag`, `default`) and fall back to `item.itemRef` when no title is available.
- [x] 2.2 Add a unit test at `package/app/src/shelf/pages/titleOf.test.ts` covering: book with translations, review with `extra.title`, review with no title (falls back to `itemRef`), tag with `translations`, tag with `label` only, and an unsupported kind.

## 3. Rewrite `ShelfItemRenderer` to dispatch by kind

- [x] 3.1 In `package/app/src/shelf/components/ShelfItemRenderer.tsx`, remove the `title` prop. Accept `{ item, viewMode }` only.
- [x] 3.2 Inside the renderer, read the kind's cached DTO via `useQueryClient().getQueryData(<key>.detail(item.itemRef))` for `book`, `review`, `quote`, `post`, `tag`.
- [x] 3.3 For a missing cache entry on a supported kind, return `null` (React will re-render once `useShelfHydration` seeds the cache).
- [x] 3.4 Dispatch:
  - `book` → `<BookCard>` (import from `@/book-library/components/item/VerticalBookCard.tsx`) with `title`, `coverUrl`, `author` (from the book's first attribution), `description`, and an `href` to `/book/${itemRef}`.
  - `review` → `<ReviewCard review={postDTO} />` (import from `@/review/components/item/ReviewCard.tsx`).
  - `quote` → `<ExcerptCard excerpt={postDTO} />` (import from `@/excerpt/components/item/ExcerptCard.tsx`).
  - `post` → `<PostCard post={postDTO} />` (import from `@/post/components/item/PostCard.tsx`).
  - `tag` → `<SingleTagChip tag={tagDTO} />` (import from `@/tag/components/TagList.tsx`).
- [x] 3.5 For all other kinds, render the new generic shell from `ShelfItemCard` (see task 4.1).
- [x] 3.6 When `viewMode === "review"`, additionally map `item.reviewIds` and render a `<ReviewCard>` for each id whose `PostDTO` is present in `postKeys.detail` cache. Attached reviews missing from cache are silently omitted.
- [x] 3.7 When `viewMode === "grid"` or `"list"`, do not render attached reviews inline; preserve existing count badge behavior.

## 4. Shrink `ShelfItemCard` to the generic fallback shell

- [x] 4.1 In `package/app/src/shelf/components/ShelfItemCard.tsx`, replace the current content with a minimal `<Chip>{item.kind}</Chip>` + shortened `itemRef` layout for grid/list/review view modes. Remove the `title` prop.
- [x] 4.2 Remove the placeholder cover box that previously showed for `grid` view; the generic shell no longer simulates a cover.

## 5. Rewire `ShelfPage`

- [x] 5.1 In `package/app/src/shelf/pages/ShelfPage.tsx`, delete `getHydratedTitle` entirely.
- [x] 5.2 Remove the `title={getHydratedTitle(item)}` prop from the `<ShelfItemRenderer />` call site; pass only `item` and `viewMode`.
- [x] 5.3 Update the title-mode branch of the `sortedItems` memo to use `titleOf(item, queryClient.getQueryData(detailKeyFor(item)))` with a small inline `detailKeyFor(item)` that maps kind → key (`bookKeys.detail`, `postKeys.detail`, `tagKeys.detail`, else `undefined`).
- [x] 5.4 Confirm the memo's dependency list still includes `hydration.buckets` (or equivalent) so sort re-runs when hydration completes.

## 6. Validation

- [x] 6.1 Run `bun tsc --noEmit` independently in `package/api` and `package/app`; resolve all errors introduced by this change (ignore pre-existing cross-package alias noise).
- [x] 6.2 Run `bun test` in `package/app` and ensure `titleOf.test.ts` passes.
- [ ] 6.3 Start `bun run app:dev` and open a shelf containing at least one `book`, one `review`, one `tag`, and one unsupported kind. Verify:
  - Books show covers and titles.
  - Reviews show body and rating.
  - Tags show translated labels.
  - Unsupported kinds show the generic kind-chip shell.
  - Toggling to `review` view mode renders attached `ReviewCard`s beneath each primary item.
  - Title sort orders items alphabetically by derived title and stabilises once hydration completes.
- [x] 6.4 Run `bun run check:convention` and `bun run format:check` across the repo.
