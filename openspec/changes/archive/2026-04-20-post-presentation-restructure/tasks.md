## 1. Prepare post/ feature scaffold

- [x] 1.1 Create `package/app/src/post/` with subfolders `components/item`, `components/parts`, `sections`, `forms`, `hooks`, and an empty `index.ts` (no content yet; populated by later tasks).
- [x] 1.2 Verify `bun run check:convention` passes with the new empty scaffold (confirms folder names are in the allowlist from `openspec/specs/folder-naming-convention/spec.md`).

## 2. Extract shared post parts

- [x] 2.1 Create `package/app/src/post/components/parts/PostAuthorHeader.tsx` extracted from the current `PostCard`/`SingleReview` header rendering. Accept `post: PostDTO` and a `size?: "compact" | "default"` variant prop. No side effects; no edit affordance.
- [x] 2.2 Create `package/app/src/post/components/parts/PostBodyMarkdown.tsx` that composes `MarkdownContent` from `@rezics/ui` with an optional `Collapsible` wrapper. Props: `body: string`, `clamp?: { maxLines: number } | false`. Default `clamp` unset (no clipping); preview surfaces pass `{ maxLines: 4 }`.
- [x] 2.3 Create `package/app/src/post/components/parts/PostReactionFooter.tsx` that parses `post.reactionSummaries` via `parseReactionSummaries` and renders the reaction row plus reply count. Props include `onReply?: () => void` so sections can inject a handler without coupling to a mutation.
- [x] 2.4 Wire `package/app/src/post/index.ts` to re-export the parts as named exports.

## 3. Build item and reply atoms

- [x] 3.1 Create `package/app/src/post/components/item/PostCard.tsx` composed from the parts. Props: `post: PostDTO`, `onOpen?: () => void`. Applies `Collapsible` `maxLines={4}` to the body. No `useCanEdit`, no edit dialog.
- [x] 3.2 Create `package/app/src/post/components/item/PostReply.tsx` for tree-node rendering. Props: `post: PostDTO`, `indentLevel: number`, `isCollapsed: boolean`, `onToggleCollapse: () => void`, `onReply?: () => void`. Computes horizontal padding from `indentLevel`; renders `borderLeft` accent driven by the real `post.depth` via a CSS variable. No side-effectful hooks.
- [x] 3.3 Export `PostCard` and `PostReply` from `post/index.ts`.

## 4. Move forms and edit dialog into post/forms

- [x] 4.1 Move `package/app/src/discussion/components/InlinePostForm.tsx` → `package/app/src/post/forms/InlinePostForm.tsx`.
- [x] 4.2 Move `package/app/src/discussion/components/ReplyDrawer.tsx` → `package/app/src/post/forms/ReplyDrawer.tsx`.
- [x] 4.3 Move `package/app/src/discussion/components/PostEditDialog.tsx` → `package/app/src/post/forms/PostEditDialog.tsx`. Dialog stays as an internal form used by edit routes; callers construct and mount it explicitly.
- [x] 4.4 Update internal imports inside these files to new paths; run `bun run tsc --noEmit` for `package/app`.

## 5. Build post sections

- [x] 5.1 Create `package/app/src/post/hooks/usePostTreeCollapse.ts` owning a `Set<string>` of collapsed `unitId`s and a `filterBySortPathPrefix` helper that hides descendants of collapsed ancestors. Seed with posts whose `depth >= 2` collapsed by default. Unit-test the filter (no React dependency).
- [x] 5.2 Create `package/app/src/post/sections/PostTreeSection.tsx`. Props: `rootPostUnitId: string`, `maxDepth?: number` (default `5`), `visualMaxDepth?: number` (default `4`). Uses `postThreadQuery(rootPostUnitId, { mode: "threaded", maxDepth })`. Owns collapse state via `usePostTreeCollapse`. Maps visible posts to `<PostReply>` with `indentLevel = Math.min(post.depth, visualMaxDepth)`. Renders a "continue thread" affordance on posts at `depth === maxDepth` with `directReplyCount > 0` that navigates to a sub-rooted view.
- [x] 5.3 Create `package/app/src/post/sections/PostListSection.tsx`. Props: `targetUnitId: string`, `kind?: PostKind`, `limit?: number`. Fetches top-level posts for the target and maps to `<PostCard>`. Empty state renders a localized "no discussions" placeholder.
- [x] 5.4 Export `PostTreeSection` and `PostListSection` from `post/index.ts`.

## 6. Rewire existing discussion call sites

- [x] 6.1 Update `package/app/src/book-library/pages/BookDiscussionPage.tsx` to import `PostListSection` from `@/post` instead of `ThreadList` from `@/discussion/...`.
- [x] 6.2 Update every other importer of `@/discussion/components/*` (grep for `from "@/discussion/`) to consume the equivalent `@/post/...` export.
- [x] 6.3 Delete `package/app/src/discussion/` in its entirety (components, `index.ts`, any dangling files).
- [x] 6.4 Re-run `bun run tsc --noEmit` for `package/app`; resolve any path-alias fallout surfaced by the delete.

## 7. Restructure remark feature

- [x] 7.1 Create `package/app/src/remark/components/item/` and move/merge `package/app/src/remark/components/RemarkCard.tsx` with `package/app/src/review/components/SingleRemark.tsx` into a single `remark/components/item/RemarkCard.tsx`. The merged card: composes `PostAuthorHeader`, `PostBodyMarkdown` (with `Collapsible` `maxLines={4}`), `PostReactionFooter`; renders rating from `post.extra.rating`; contains no `useCanEdit` and no edit dialog.
- [x] 7.2 Create `package/app/src/remark/components/list/RemarkList.tsx` (pure list shell) and move/merge the existing `remark/components/RemarkList.tsx` + `review/components/ShortReviewList.tsx` behavior into it. Accepts `posts: PostDTO[]`; maps to `<RemarkCard>`. No fetching.
- [x] 7.3 Create `package/app/src/remark/components/detail/RemarkDetail.tsx` — focal, container-less, no body clamp, includes rating / recommendation cue and link to book. Composes the shared parts.
- [x] 7.4 Create `package/app/src/remark/sections/RemarkListSection.tsx` (fetches remarks for a target book; maps to `<RemarkList>`) and `package/app/src/remark/sections/RemarkDetailSection.tsx` (fetches focal remark + renders `<RemarkDetail>` + `<PostTreeSection rootPostUnitId={post.unitId} />`).
- [x] 7.5 Move `package/app/src/remark/components/RemarkInlineForm.tsx` and `RemarkEditDialog.tsx` into `package/app/src/remark/forms/`.
- [x] 7.6 Rewrite `package/app/src/remark/index.ts` to export only the new public surface (`RemarkCard`, `RemarkDetailSection`, `RemarkListSection`, forms as needed).
- [x] 7.7 Update `package/app/src/book-library/components/RemarkPreview.tsx` to import `RemarkList` (or a `RemarkListSection` variant) from `@/remark`. Remove the `@/review/components/ShortReviewList` import.
- [x] 7.8 Delete `package/app/src/review/components/SingleRemark.tsx` and `ShortReviewList.tsx`.
- [x] 7.9 Run `bun run tsc --noEmit` for `package/app`; resolve fallout.

## 8. Restructure excerpt feature

- [x] 8.1 Create `package/app/src/excerpt/components/detail/ExcerptDetail.tsx` — focal view with full source citation (via `SafeLink` for external URLs, `<Link to="/unit/$unitId">` for unit links), no card container.
- [x] 8.2 Merge `package/app/src/review/components/SingleExcerpt.tsx` behavior into `package/app/src/excerpt/components/item/ExcerptCard.tsx` (adopting the `UnitDTO` contract and composing the shared parts; keep the existing `ExcerptCard` location).
- [x] 8.3 Merge `package/app/src/review/components/ExcerptList.tsx` into `package/app/src/excerpt/components/list/`. Remove custom props in favor of `posts/units` array.
- [x] 8.4 Create `package/app/src/excerpt/sections/ExcerptDetailSection.tsx` (fetches focal excerpt + `<ExcerptDetail />` + `<PostTreeSection>`).
- [x] 8.5 Update `package/app/src/excerpt/pages/ExcerptPage.tsx` to render `<ExcerptDetailSection unitId={unitId} />`.
- [x] 8.6 Update `package/app/src/excerpt/index.ts` to export the new public surface.
- [x] 8.7 Update `package/app/src/book-library/components/ExcerptPreview.tsx` to import from `@/excerpt` only.
- [x] 8.8 Delete `package/app/src/review/components/SingleExcerpt.tsx`, `ExcerptList.tsx`, and the associated `SingleExcerpt.test.tsx` if its coverage is obsolete (or move it to the new location).

## 9. Restructure review feature

- [x] 9.1 Move `package/app/src/review/components/SingleReview.tsx` content into a new `package/app/src/review/components/detail/ReviewDetail.tsx` — focal view including book cover/title, full Markdown body, score, author header, reactions. No card container. No `Collapse` clamp.
- [x] 9.2 Keep `package/app/src/review/components/item/ReviewCard.tsx` and `VerticalTwoReviewCard.tsx`; update them to render `body` via `PostBodyMarkdown` with `Collapsible` `maxLines={3}`.
- [x] 9.3 Move `package/app/src/review/components/ReviewList.tsx` into `package/app/src/review/components/list/ReviewList.tsx` (pure list shell, no `useReducer`). Sections own state.
- [x] 9.4 Create `package/app/src/review/sections/ReviewDetailSection.tsx` (fetches focal review + `<ReviewDetail />` + `<PostTreeSection>`) and `package/app/src/review/sections/ReviewListSection.tsx` (wraps `<ReviewList>` with the data fetch and pagination state previously in `ReviewList.tsx`).
- [x] 9.5 Move `ReviewEditPage`/`ReviewNewPage` form logic into `package/app/src/review/forms/` if it isn't already.
- [x] 9.6 Update every `@/review/components/ReviewList` importer (`BookReviewPage`, `BookReviewsPreview`, `UserUnitsPage`, `ReviewsPage`, `ReviewSearchPage`) to use `ReviewListSection` (where fetching was duplicated) or `ReviewList` (where posts are passed in).
- [x] 9.7 Delete `package/app/src/review/components/SingleReview.tsx`, the old `ReviewList.tsx`, and the loose test files once colocated with their new home.

## 10. Add missing edit routes and decouple edit from cards

- [x] 10.1 Audit `package/app/src/routes/_mainLayout/remark/` for a `$reviewId/edit.tsx` route; if missing, add one that renders `<RemarkEditPage>` (thin wrapper over `RemarkEditDialog` or a dedicated page form).
- [x] 10.2 Audit `package/app/src/routes/_mainLayout/excerpt/` for an `$unitId/edit` route; if missing, add one.
- [x] 10.3 Remove `useCanEdit`, `EditOutlined` trigger, and `*EditDialog` imports from the merged `RemarkCard`, from `ExcerptCard`, from any `ReviewCard`, and from `PostCard`/`PostReply`. Edit entry points move to the detail sections (as a section-owned action) and to the dedicated edit routes.
- [x] 10.4 Verify each detail section renders its own edit affordance when the current user has permission (via `useCanEdit` inside the section, not the card).

## 11. Tree depth cap and continue-thread affordance

- [x] 11.1 Confirm `postThreadQuery` and downstream API client accept `{ mode: "threaded", maxDepth }` unchanged (already supported per `package/contract/src/post.ts:107` and `package/server/src/post/post.service.ts:44`).
- [x] 11.2 Implement the indent cap inside `PostTreeSection` and `PostReply` (no new shared constants module needed; keep `VISUAL_MAX_DEPTH` as a section-level default with a prop override).
- [x] 11.3 Implement the "continue thread" affordance: on posts at `depth === maxDepth` with `directReplyCount > 0`, render a link/button that routes to `/post/$rootPostUnitId/continue/$unitId` or an equivalent deep-anchor route. Define the route under `package/app/src/routes/` and add a minimal `ContinueThreadSection` that renders `<PostTreeSection rootPostUnitId={unitId} />` plus a breadcrumb back to the original root.
- [x] 11.4 Add a unit test for `usePostTreeCollapse` covering: default depth-≥2 collapse, toggle expand, descendant filtering by `sortPath` prefix.

## 12. Clean-up and verification

- [x] 12.1 Delete `package/app/src/review/components/RankingView.tsx` (empty file).
- [x] 12.2 Run `bun run format:check` and `bun run tsc --noEmit` for `package/app`. Fix formatting and any remaining type errors.
- [x] 12.3 Run `bun run check:convention` at the repo root.
- [x] 12.4 Grep for residual references: no `ShortReview`, no `SingleRemark`, no `SingleReview` (in `components/`), no `SingleExcerpt`, no `@/discussion/`, no `ThreadView`, no `ThreadList` remain.
- [x] 12.5 Smoke-test the affected surfaces manually in `bun run app:dev`: `/book/$id` review tab (score overview + inline remark form + remark list + review list), `/remark/$id` detail page, `/remark/book/$bookId`, `/review/$id` detail page, `/review/book/$bookId`, `/excerpt/$id` detail page, a thread with depth ≥ 3 including the continue-thread affordance.
- [x] 12.6 Update `openspec/specs/work-discussion/spec.md` by archiving the change (handled automatically by `/opsx:archive` — no manual edit needed).
