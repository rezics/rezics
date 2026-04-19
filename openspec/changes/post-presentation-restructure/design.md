## Context

Post-like content (`PostDTO` with `kind` of `REVIEW`, `REMARK`, `EXCERPT`, or `POST`) is currently presented across several overlapping locations in `package/app/src`:

- `discussion/` — a misnamed home for generic post-tree rendering (`ThreadView`, `ThreadList`, `PostCard`, `ReplyDrawer`, `InlinePostForm`, `PostEditDialog`). The name implies a domain, but the implementation is the generic post-threading capability used by every work-detail page.
- `review/components/` — mixes correctly-placed `item/` and `list/` files with loose legacy files (`SingleReview`, `ReviewList`, `SingleRemark`, `ShortReviewList`, `SingleExcerpt`, `ExcerptList`), an empty `RankingView.tsx`, and a remnant test pair. `ShortReviewList` renders posts of `kind: REMARK` via `SingleRemark`; the name survived a migration where the REMARK kind was split out of REVIEW at the contract layer but never propagated to the UI.
- `remark/components/` — a half-populated feature folder with `RemarkCard`, `RemarkEditDialog`, `RemarkInlineForm`, `RemarkList` but no `item/`, no `list/`, no `detail/`. It duplicates presentation responsibility with `review/components/SingleRemark.tsx`.
- `excerpt/components/` — the exemplar: `item/`, `list/`, `source/` already exist. The loose `SingleExcerpt`/`ExcerptList` still under `review/` are the counterpart that never moved.

Two additional defects touch every presentation file:

1. **Body rendering is split.** `SingleRemark` and `SingleExcerpt` render `post.body` as Markdown via `MarkdownContent` + `Collapsible`. `RemarkCard`, `PostCard`, `SingleReview`, `ExcerptCard` render it as plain `Typography`. The body column is Markdown at the database layer; the plaintext paths are wrong.
2. **Edit affordances live inside presentation cards.** `RemarkCard` and `PostCard` each `useCanEdit(...)`, render an `EditOutlined` button, and open a `RemarkEditDialog` / `PostEditDialog`. This binds display to authorization state and makes card components untrustable in stateless rendering contexts.

The `PostDTO` threading fields (`rootPostUnitId`, `parentPostUnitId`, `sortPath`, `depth`) and the server's `mode: "threaded"` + `maxDepth` query parameters are already in place and usable as of commit `becef56b`. No backend or contract work is required to implement the tree depth cap.

## Goals / Non-Goals

**Goals:**
- Establish a single, predictable presentation layout for every post kind: `components/item/` for card-shaped previews, `components/list/` for list-shaped containers, `components/detail/` for detail-page focal renderings, `sections/` for any presentation that owns fetching or interaction state.
- Collapse the `discussion/` feature into a new `post/` feature whose role is the generic presentation of the `Post` abstraction. `post/components/` holds atomic renderers; `post/sections/` holds the tree and target-list orchestrators.
- Make every post body render through one Markdown path, regardless of kind or surface.
- Remove edit UI from presentation components. Editing moves to a dedicated route per kind.
- Cap post-tree depth so both the server round-trip and the client render cost stay bounded, with an escape hatch for users who want to keep reading deep threads.
- Rewrite the `work-discussion` spec so that "Discussion" is explicitly a UX surface implemented on top of the `post` module, not a standalone module.

**Non-Goals:**
- No changes to routing paths (`/review/*`, `/remark/*`, `/excerpt/*`, `/book/$bookId/...`) that would affect bookmarks or external links.
- No changes to `PostDTO`, `PostKind`, the contract, the Prisma schema, or Meilisearch indexing.
- No behavior changes to reactions, score system, authentication, or authorization logic.
- No visual redesign beyond what falls out of unifying Markdown rendering and removing inline edit buttons. Apple-inspired style guidelines (borderless, inline) stay as-is.
- No introduction of a shared "card base class" at the React level beyond small composable parts (`PostAuthorHeader`, `PostBodyMarkdown`, `PostReactionFooter`). Variants that differ meaningfully remain separate components.

## Decisions

### D1. `discussion/` feature is renamed and restructured into `post/`
The generic post-threading capability is not a discussion-specific domain; it is the presentation layer for the `Post` abstraction. Using `post/` makes the dependency explicit — `remark/`, `review/`, and `excerpt/` consume `post/` primitives on detail pages — and frees the word "discussion" to describe the UX surface on work detail pages rather than the code module.

**Alternative considered:** keep `discussion/` and add a separate `post/` for shared primitives. Rejected because it splits presentation responsibility across two folders and perpetuates the misnomer.

### D2. Presentation atomicity lives in `components/`; orchestration lives in `sections/`
Per the feature standard at `package/app/docs/feature standard.md`: `components/` must not produce side effects; `sections/` compose `components/` with fetches, stores, and interaction state.

Concretely:

```
post/components/
├── item/
│   ├── PostCard.tsx          contained preview, body clamp, whole-card click
│   └── PostReply.tsx         tree-node layout, accepts indentLevel/isCollapsed as props
└── parts/
    ├── PostAuthorHeader.tsx  avatar + name + date (size variant)
    ├── PostBodyMarkdown.tsx  MarkdownContent + optional Collapsible
    └── PostReactionFooter.tsx parseReactionSummaries + reaction row

post/sections/
├── PostListSection.tsx       targetUnitId → fetch top-level posts → map PostCard
└── PostTreeSection.tsx       rootPostUnitId → fetch threaded (mode, maxDepth) → collapse state → map PostReply

post/forms/
├── InlinePostForm.tsx        inline composer (desktop detail pages)
├── ReplyDrawer.tsx           bottom-sheet composer (mobile and any narrow surface)
└── PostEditDialog.tsx        edit composer (opened from dedicated edit routes)

post/hooks/
└── usePostTreeCollapse.ts    collapse-id set + sortPath-prefix filter (extracted from PostTreeSection for testability)
```

**Alternative considered:** a `PostTreeView` component in `components/tree/` that internally calls `useQuery` and manages collapse state. Rejected because it violates the feature standard — `components/` must be side-effect-free — and it hides data dependencies behind what looks like a pure render.

### D3. Each kind folder mirrors the post layout with a `detail/` layer
`remark/`, `review/`, `excerpt/` each gain the full three-layer shape:

```
<kind>/
├── components/
│   ├── item/<Kind>Card.tsx    preview in list/carousel contexts
│   ├── list/<Kind>*Carousel.tsx or <Kind>List.tsx  kind-specific list shapes
│   └── detail/<Kind>Detail.tsx focal view on the detail page; not a card
├── sections/
│   └── <Kind>DetailSection.tsx fetches root post, composes <KindDetail> + <PostTreeSection>
├── forms/                      kind-specific composers (inline remark form, review editor, excerpt picker)
├── pages/                      thin route entries
└── index.ts                    the one public export
```

The per-kind `Detail` component is intentionally distinct from the card. A card has a container, a clamp, and a click target; a detail view is focal content with no container, full body, author follow affordances, and kind-specific metadata (score / book / excerpt source).

**Alternative considered:** a shared `PostDetailBase` in `post/components/detail/` with `RemarkDetail`, `ReviewDetail`, `ExcerptDetail` extending it. Rejected because the three detail views diverge meaningfully (review shows a book header, excerpt shows a quoted source, remark shows a rating/recommendation badge). A shared parent with generous slots becomes either rigid or a thin pass-through. Instead, the kind-specific details compose `post/components/parts/*` directly.

### D4. Post body is Markdown everywhere
All card, reply, and detail surfaces render `post.body` through `post/components/parts/PostBodyMarkdown.tsx`, which composes `MarkdownContent` (from `@rezics/ui`) and, where the surface needs to clip, `Collapsible`. No other path to render `post.body` is allowed.

Rationale: the stored body is Markdown; any plaintext surface silently drops formatting (lists, code, links). A single component localises the contract, and keeps the `Collapsible` `maxLines` policy consistent (preview surfaces use `maxLines={4}`, detail surfaces render unclipped).

### D5. Edit UI is decoupled from presentation
`PostCard`, `PostReply`, `RemarkCard`, `ReviewCard`, `ExcerptCard` SHALL NOT:
- Call `useCanEdit`
- Render an edit button or menu
- Import or open any `*EditDialog`

Editing is reached by navigating to the dedicated edit route per kind (`/review/$reviewId/edit` already exists; `/remark/$remarkId/edit` and `/excerpt/$unitId/edit` follow the same convention). The detail page surfaces the edit affordance for its own root post when the user has permission — the edit button is an element of the detail section, not the card that happens to be inside it.

Rationale: authorisation is a cross-cutting concern that changes based on who is logged in; baking it into a presentation component forces every render path to be authenticated and stateful. It also caused the `RemarkCard` in `remark/` to drift from `SingleRemark` in `review/` — they could not converge because one was "editable" and the other was not.

**Alternative considered:** keep edit buttons on cards but extract the dialog so only the trigger is local. Rejected because the permission check (`useCanEdit`) is itself the coupling — presentation should accept a `post` prop and render it.

### D6. Tree depth is capped server-side at 5 and visually at 4
`PostTreeSection` queries with `{ mode: "threaded", maxDepth: 5 }`. The server's existing `where.depth = { lte: maxDepth }` clause (verified in `package/server/src/post/post.service.ts`) prevents deep subtrees from loading in the initial response.

Frontend indent caps at `VISUAL_MAX_DEPTH = 4`. `PostReply` receives `indentLevel = Math.min(post.depth, VISUAL_MAX_DEPTH)`. The border-left decoration keeps shading by real depth (CSS variable) so users can still perceive thread continuation visually.

For replies beyond the loaded window, the reply that sits at `depth === 5` with `directReplyCount > 0` SHALL render a "continue thread" affordance. Activating it navigates to the detail surface anchored on that reply as a new root, triggering a fresh `PostTreeSection` query with that node as `rootPostUnitId`.

Default collapse policy: replies with `depth >= 2` are collapsed on initial render. Users expand per subtree; collapse state is owned by `PostTreeSection` and delegated to a `usePostTreeCollapse` hook so it can be unit-tested without React.

**Alternative considered:** client-side pagination by `sortPath` cursor with no server depth cap. Rejected because the server already supports `maxDepth` and applying it upstream reduces payload size and DB work. The cursor mechanism remains available for extremely wide threads, but depth is the limiting dimension for the tree-traversal cost this change addresses.

### D7. `work-discussion` spec is rewritten, not extended
The existing `work-discussion` spec treats the Discussion tab as an independent module. The delta rewrites its load-bearing requirements so they describe the Discussion UX as a consumer of `post/sections/PostListSection` and `post/sections/PostTreeSection`. The "Discussion module reuses Post API" requirement is removed entirely; there is no "discussion module". Requirements that describe observable behavior (locked threads, reply counts, last-reply timestamps, reply form semantics) are preserved verbatim — the behavior does not change.

**Alternative considered:** add a new spec `post-module-consumers` alongside the existing `work-discussion`. Rejected because the existing spec would remain misleading; the delta is the honest path.

## Risks / Trade-offs

**Wide import churn** → many files under `book-library/`, `user/pages/`, `review/pages/`, and the routes tree reference the moved and renamed components. Mitigation: migrate imports in the same change; run `bun run check:convention` and `bun run tsc --noEmit` per package after each feature folder lands.

**Two existing tests move with their subjects** (`SingleReview.test.tsx`, `SingleExcerpt.test.tsx`) → components migrate into new folders; tests must follow and adjust their relative imports. Mitigation: move tests in the same commit as the component.

**Hidden behavior difference between `SingleRemark` and `RemarkCard`** → the two remark-presentation components diverged in body rendering (markdown vs plaintext) and reaction parsing. The merged `RemarkCard` follows the markdown + `parseReactionSummaries` path; any consumer that relied on the plaintext shape renders correctly because Markdown is a superset. Mitigation: verify `RemarkPreview` (book-library) and the `/remark/book/:bookId` page visually post-migration.

**Collapse state lost on thread re-fetch** → React Query may replace `posts` when the thread refetches. Collapse state keyed on `unitId` survives refetch; collapse logic does not depend on array identity. Trade-off accepted: if the expanded reply disappears (e.g., deleted), its collapse entry is an orphan — harmless.

**"Continue thread" re-renders a detail page as a sub-root** → on the new root, the original parent context is not visible. Users may lose the trail. Mitigation: the detail page for a reply-anchored view renders a small breadcrumb to its `rootPostUnitId` original thread. Implemented as part of the `<PostTreeSection>` route wrapper.

**Per-kind edit routes may not exist yet** → `/review/$reviewId/edit` exists; `/remark/$remarkId/edit` and `/excerpt/$unitId/edit` may not. If missing, the detail section's edit affordance will be non-functional until those routes are added. Mitigation: this change adds the two missing edit routes (minimal wrappers over existing `RemarkEditDialog` / the existing excerpt edit page).

**Folder naming convention check** → `bun run check:convention` enforces singular/plural rules per `openspec/specs/folder-naming-convention/spec.md`. All new folders (`post/`, `item/`, `list/`, `detail/`, `forms/`, `sections/`, `parts/`) are already in the allowlist or singular domain names. Confirmed compatible.

## Migration Plan

1. Land the `post/` feature folder first (rename `discussion/` → `post/`, move files without behavior change, update internal imports). Tests and convention checks green.
2. Extract atomic parts (`PostAuthorHeader`, `PostBodyMarkdown`, `PostReactionFooter`) from current `PostCard`. Refactor `PostCard` and a new `PostReply` to compose them. Delete edit coupling from `PostCard`.
3. Introduce `PostListSection` and `PostTreeSection` in `post/sections/`. Rewire `ThreadList` and `ThreadView` call sites to the new sections, then delete the old components.
4. Per kind, in any order: move loose `SingleX`/`XList` files from `review/` into the correct `<kind>/components/` subfolders, add `<kind>/components/detail/<Kind>Detail.tsx`, add `<kind>/sections/<Kind>DetailSection.tsx`, migrate the detail page to use the section. Delete `SingleRemark`, `ShortReviewList`, `SingleExcerpt`, `ExcerptList` from `review/` once no import remains.
5. Add `maxDepth` and `mode: "threaded"` to `PostTreeSection`'s query, implement `VISUAL_MAX_DEPTH` capping in `PostReply`, and add the "continue thread" affordance.
6. Add missing `/remark/$remarkId/edit` and `/excerpt/$unitId/edit` routes. Remove inline edit affordances from all cards.
7. Delete empty `RankingView.tsx`.
8. Rewrite `work-discussion` spec (handled in this change's `specs/` delta).

**Rollback strategy:** this is a pure frontend restructure behind existing routes; `git revert` is safe. No data migration or contract change to unwind.

## Open Questions

None at propose time — all architectural questions resolved in the explore phase. Remaining decisions are local implementation (component names, hook surfaces, exact CSS variable names) and stay inside task-level work.
