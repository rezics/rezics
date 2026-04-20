## Why

The frontend presentation layer around posts (remarks, reviews, excerpts, and their replies) has drifted into an inconsistent state: the `item/list` folder convention is inconsistently applied, `remark/` content sits inside `review/` with misleading legacy names like `ShortReviewList`, tree rendering lives under a misnamed `discussion/` feature when it is really a generic post capability, presentation components are coupled to editing concerns, and post body rendering is split between plain-text and markdown. This debt makes it hard to add new post kinds, builds inconsistent UX for the same underlying entity, and mis-framed specs reinforce the confusion.

## What Changes

- **BREAKING** Rename `discussion/` feature folder to `post/` and restructure into `components/`, `sections/`, `forms/`, `hooks/` layers. Tree orchestration (`PostTreeSection`) and target-list orchestration (`PostListSection`) move to `sections/`; atomic renderers (`PostCard`, `PostReply`, reusable parts) stay in `components/`.
- **BREAKING** Rename `ShortReviewList` / `SingleRemark` (currently under `review/`) to remark-kinded equivalents and relocate into a dedicated `remark/` feature folder with `item/`, `list/`, `detail/` subfolders.
- Relocate `ExcerptList` / `SingleExcerpt` from `review/` into the existing `excerpt/` feature folder; ensure `excerpt/`, `review/`, `remark/` all expose `components/item/`, `components/list/`, and a new `components/detail/` layer.
- Introduce a per-kind `detail/` presentation layer (`RemarkDetail`, `ReviewDetail`, `ExcerptDetail`) used on detail pages in place of reusing the list-oriented card. Detail views are not cards; they are focal, container-less renderings composed from shared post parts.
- Unify post body rendering: all card, reply, and detail surfaces SHALL render `post.body` as Markdown through a single shared `PostBodyMarkdown` atom (MarkdownContent + optional Collapsible). No plaintext paths remain.
- Decouple edit affordances from presentation components: `PostCard`, `PostReply`, remark/review/excerpt cards SHALL NOT contain edit buttons or dialogs. Editing SHALL live on a dedicated route surface per kind.
- Cap post tree depth: `PostTreeSection` SHALL query the thread with `mode: "threaded"` and `maxDepth: 5`; visual indentation SHALL cap at a frontend-configured maximum; replies beyond the visible depth SHALL be reachable via a "continue thread" affordance that re-anchors the tree on the deeper node. Collapse state for branches SHALL live in the section.
- Re-frame `work-discussion` capability: the spec is rewritten to describe the Discussion UX surface as a **consumer** of the `post` module's target-list and tree-section primitives, not as a self-contained module. The `discussion/` feature folder ceases to exist.
- Delete empty artifact `package/app/src/review/components/RankingView.tsx` (0 bytes, never implemented).

## Capabilities

### New Capabilities
- `post-presentation-architecture`: Defines how the `post/` module and kind-specific features (`remark/`, `review/`, `excerpt/`) structure their presentation layers. Covers the atomic-component vs. orchestrating-section split, the three presentation modes (card / reply-node / detail), the shared post parts (author header, markdown body, reaction footer), the markdown-body contract, the edit-decoupling rule, and the tree-depth cap policy.

### Modified Capabilities
- `work-discussion`: Rewritten to express discussion as a UX surface built on the `post` module's primitives. Removes the standalone "discussion module" framing, removes references to a `discussion/` feature folder, and restates threading/reply/locked-thread requirements as behaviors of `PostTreeSection` and `PostListSection` rather than a dedicated discussion module.

## Impact

- **Affected packages**: `package/app` (primary — folder restructure, new sections, deleted components, re-wired detail pages).
- **Affected modules under `package/app/src`**:
  - `discussion/` → deleted after content migrates to `post/`
  - `review/components/` → pruned; remark/excerpt content moves out; `detail/` added
  - `remark/` → expanded into full feature layout (`components/item`, `components/list`, `components/detail`, `sections/`, `forms/`)
  - `excerpt/` → gains `components/detail/` and absorbs the loose `ExcerptList`/`SingleExcerpt`
  - `book-library/components/RemarkPreview.tsx`, `BookReviewsPreview.tsx`, `ExcerptPreview.tsx` → import-path updates
  - `user/pages/UserUnitsPage.tsx`, `review/pages/*`, `book-library/pages/*` → import-path updates after renames
- **Backend**: no changes required. `PostListQuery.maxDepth` and `mode: "threaded"` are already supported end-to-end (`package/contract/src/post.ts`, `package/server/src/post/post.service.ts`).
- **Backward compatibility**: this is an internal frontend refactor; no public API, route, or database shape changes. Route paths for `/remark/*`, `/review/*`, `/excerpt/*` are preserved. Consumers outside `package/app` are unaffected.
- **Migration**: imports across `package/app` must be updated in the same change. The `discussion/` folder is deleted only after all call sites are rewired through `post/`.
- **Risk**: moderate — touches many files but behavior-preserving. Test coverage exists for `SingleReview` and `SingleExcerpt`; tests move with their components.
