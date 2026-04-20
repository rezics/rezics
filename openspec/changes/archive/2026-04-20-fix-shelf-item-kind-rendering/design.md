## Context

The shelf feature is structurally complete: `useShelfHydration` (`package/api/src/shelf/useShelfHydration.ts`) already groups items by kind-to-endpoint and seeds full DTOs into per-domain detail caches via `queryClient.setQueryData(bookKeys.detail(id), book)` etc. `ShelfPage` then reads from those caches. The problem is entirely in the last mile:

1. `ShelfItemRenderer` funnels every kind through a single generic `ShelfItemCard` that only displays a `kind` chip and a title string. It never uses `coverUrl`, author, body, rating, or any other DTO field.
2. `ShelfPage.getHydratedTitle()` reads fields that don't exist on the returned shapes:
   - `post?.translations?.[0]?.title` — `PostDTO` has no `translations`; title lives at `post.extra?.title`.
   - `tag?.label` — the frontend type (`UnitTagDTO`) is the scored junction row; at runtime the `/tag/list` endpoint actually returns `{unitId, label, translations, slug}` (via `mapTagUnitToDTO` on the server), so the read works by accident but the types lie.
3. `useShelfHydration` only batches each item's primary `itemRef`. It ignores `reviewIds` and `tagIds` — the attachment arrays that the `shelf-batch-hydration` spec already requires be hydrated through the same pipeline.

Domain cards already exist and are used elsewhere in `package/app`:

- `BookCard` at `book-library/components/item/VerticalBookCard.tsx` — primitive props `{title, author, description, coverUrl, href}`.
- `HorizontalBookCard` — same props, list-view variant.
- `ReviewCard` at `review/components/item/ReviewCard.tsx` — takes `{review: PostDTO}`, reads `extra.book.coverUrl`, `extra.title`, `extra.rating` itself.
- `ExcerptCard` at `excerpt/components/item/ExcerptCard.tsx` — takes `{excerpt: UnitDTO}`.
- `PostCard` at `post/components/item/PostCard.tsx` — takes a `PostDTO`.
- `SingleTagChip` at `tag/components/TagList.tsx` — takes a tag DTO.

The only backend list endpoint that would be required for a truly generic fallback is `/unit/list` (`package/server/src/unit/unit.api.ts:69-92`), but it is admin-gated by `BasicAdminPermission`. Opening it for public `ids`-only reads is out of scope; unsupported kinds will render a minimal shell without any network request.

Active scope of this change: `package/api/src/shelf/useShelfHydration.ts`, `package/app/src/shelf/components/ShelfItemRenderer.tsx`, `package/app/src/shelf/components/ShelfItemCard.tsx`, `package/app/src/shelf/pages/ShelfPage.tsx`, plus a small `titleOf.ts` helper colocated with the page.

## Goals / Non-Goals

**Goals:**

- Each shelf item renders through its domain card (book/review/excerpt/post/tag) fed the full cached DTO.
- Book covers, review bodies, excerpt quotes, and tag labels all appear without any additional round-trip once hydration completes.
- Attached `reviewIds` under a primary item render as `ReviewCard`s sourced from the same `/post/list` batch.
- Title-mode sorting uses a dedicated pure function and does not leak into the rendering path.
- Unsupported kinds render a small generic shell with zero network traffic.

**Non-Goals:**

- No changes to `@rezics/contract`, server code, or any API route.
- No relaxation of `/unit/list` permissions.
- No new cards or styling overhaul — reuse existing domain cards as-is.
- No change to orphan detection, cleanup mutation, sort-mode UI, or view-mode toggle semantics.
- No change to `shelfItemsQuery` response shape.

## Decisions

### Decision 1 — Dispatch by `kind` inside `ShelfItemRenderer`, read the cache directly

`ShelfItemRenderer` switches on `item.kind` and reads the hydrated DTO from the cache using the same keys `useShelfHydration` seeds against (`bookKeys.detail`, `postKeys.detail`, `tagKeys.detail`). No `title` prop is passed down; each card consumes the full DTO.

```
ShelfItemRenderer({ item, viewMode })
  switch item.kind:
    "book"   →  book = qc.getQueryData(bookKeys.detail(item.itemRef))
                if book: <BookCard {...bookCardPropsFrom(book)} /> + attached reviews
                else:    null (orphan filter already hides it)
    "review" →  post = qc.getQueryData(postKeys.detail(item.itemRef))
                if post: <ReviewCard review={post} />
    "quote"  →  <ExcerptCard excerpt={...} />
    "post"   →  <PostCard post={...} />
    "tag"    →  <SingleTagChip tag={...} />
    default  →  <GenericShelfItemShell item={item} />
```

**Alternatives considered:**
- Keep a `title` prop on the renderer and pass strings in from the page. Rejected because it re-introduces the exact `getHydratedTitle` extraction bug class — each card needs more than a title.
- Subscribe to the detail cache with `useQuery({ queryKey, enabled: false })` per item. Rejected as noise; the batch hydration already fires the actual fetch and `useQueries` inside the hook triggers the re-render. A synchronous `getQueryData` read at render time is sufficient and is the pattern already used today.

### Decision 2 — Fold attachments into the same bucket grouping

`useShelfHydration` expands each item into its primary `itemRef` **plus** every id in `reviewIds` (→ post bucket) and `tagIds` (→ tag bucket) before de-duping and calling the list endpoints. Attached reviews and tags then render from the same seeded caches.

```
for item in items:
  primary[bucketOf(item.kind)] += [item.itemRef]
  postBucket                   += item.reviewIds
  tagBucket                    += item.tagIds
```

Attachments fold into the pre-existing buckets. No new bucket is created. Duplicates inside a bucket are removed before the list call.

**Alternative considered:** separate `attachment-posts` and `attachment-tags` buckets. Rejected — the `shelf-batch-hydration` spec explicitly says attachments join the same batch.

### Decision 3 — Return typed buckets, delete the `{unitId: string}` type-lie

Change `BucketResult.data` from `Array<{ unitId: string }>` to a discriminated union keyed on bucket name, carrying the real DTO arrays. This makes the cache-seeding call site type-check and means consumers of `hydration.buckets.book?.data` get the real `BookDTO[]` back.

**Alternative considered:** leave types loose and fix only the render path. Rejected — the type erasure is what let the post/tag title-extraction bug land in the first place.

### Decision 4 — `titleOf(item, cached)` is a pure sort helper, not a render helper

Introduce `package/app/src/shelf/pages/titleOf.ts`:

```ts
export function titleOf(item: ShelfItemDTO, cached: unknown): string {
  switch (item.kind) {
    case "book":
      return (cached as BookDTO | undefined)?.translations?.[0]?.title ?? item.itemRef;
    case "review":
    case "quote":
    case "post":
      return (cached as PostDTO | undefined)?.extra?.title ?? item.itemRef;
    case "tag":
      // tag list endpoint returns { translations, label, ... } at runtime;
      // using any-cast here, not adjusting the contract type in this change.
      return (cached as any)?.translations?.[0]?.title
          ?? (cached as any)?.label
          ?? item.itemRef;
    default:
      return item.itemRef;
  }
}
```

Used only by `ShelfPage`'s `sortedItems` memo when `sortMode === "title"`. The rendering path never reads it.

**Alternatives considered:**
- Add a `title` field to the renderer prop. Rejected — see Decision 1.
- Parameterize rendering with a union `RenderSpec` object computed once per item. Rejected — more abstraction than warranted; `switch(kind)` inside the renderer is explicit and local.

### Decision 5 — Generic shell is network-free

`ShelfItemCard` becomes the unsupported-kind shell. It shows `<Chip>{kind}</Chip>` plus a shortened `itemRef`. No query is registered for unsupported kinds; they are skipped by the bucket grouping exactly as they are today.

**Alternative considered:** relax `/unit/list` to public ids-only and use it as the universal hydrator for unknown kinds. Rejected as scope creep and a permission boundary change that deserves its own proposal.

### Decision 6 — Orphan detection unchanged; attachments do not count for orphan logic

Attached `reviewIds`/`tagIds` that fail hydration are silently hidden in place (the attachment just doesn't render). Only primary `itemRef` failures feed into the existing `orphanItemRefs` path. This matches the spec's "orphan detection and author-triggered cleanup" requirement, which is scoped to primary slots.

## Risks / Trade-offs

- **[Risk]** Cache reads in `ShelfItemRenderer` run synchronously; if `useShelfHydration`'s `useQueries` hasn't yet completed on first paint, cards render as nothing and snap in after. → Mitigation: `useShelfHydration` already returns `isLoading` and `buckets`; `ShelfPage` keeps its existing loading fallback and orphan filter. When a bucket has resolved but a specific id is missing, the item is classified as orphan and filtered out. Between "hydration pending" and "resolved", the renderer can return `null` for a missing cache entry and React will re-render when `useQueries` completes.
- **[Risk]** `ReviewCard` expects `extra.book.coverUrl`/`extra.book.title`; reviews attached to non-book shelves (e.g. a shelf of posts) may render without a cover thumbnail. → Acceptable: the card already handles missing `extra.book` gracefully; behavior matches the rest of the app.
- **[Trade-off]** Tag DTO shape mismatch between contract (`UnitTagDTO`) and runtime (`mapTagUnitToDTO` output) is left untouched. `titleOf` uses `any`-casts to bridge it. A proper contract fix belongs in a separate change that touches `@rezics/contract` and every `tagApi.list` consumer.
- **[Trade-off]** Unsupported kinds remain visually minimal. Users who add `realm`/`game`/`link` items to a shelf will see kind-chip shells rather than rich cards. Improving those requires either opening `/unit/list` or adding per-kind list endpoints — both out of scope.

## Migration Plan

No data migration. No backend deploy. No rollback complexity — this is a frontend-only refactor behind existing query keys.

1. Land the change on `dev`.
2. Reload any open shelf page; hydrated cards replace the generic placeholders on next render.
3. If a regression appears, revert the PR; the prior generic-card behavior is restored immediately.

## Open Questions

- Should `titleOf` live at `package/app/src/shelf/pages/titleOf.ts` (colocated) or in `package/api/src/shelf` (shared)? Current plan is colocated — it is sort-UI-adjacent and only `ShelfPage` consumes it. If another surface later needs it we can promote.
- Review cards in `viewMode === "review"` currently render each primary item's `reviewIds` inline. Do we also want to render them in `grid` mode under each book thumbnail, or only in `review` mode? Current plan: attachments render in `review` mode only; `grid` and `list` show a count badge. This matches the pre-existing ShelfItemCard affordance.
