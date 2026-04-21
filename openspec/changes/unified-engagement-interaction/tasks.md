## 1. Foundation: engagement atoms (Phase 1)

- [ ] 1.1 Add an `Action` token union to `package/app/src/engagement/types.ts` covering `"vote" | "reply" | "share" | "shelf" | "more" | "funny" | "award"` with a JSDoc note that `funny` / `award` are reserved and must not render UI in this change.
- [ ] 1.2 Add the `ActionPolicy` type (`{ actions: Action[]; overflow?: Action[] }`) to the same file and document in JSDoc the rule that unknown tokens are silently ignored and that a token present in both `actions` and `overflow` resolves to visible.
- [ ] 1.3 Create `package/app/src/engagement/components/VoteGroup.tsx` as a self-contained atom. It takes `{ targetUnitId, initialScore, initialUserVote, size }`, calls `useToggleReaction` internally, abbreviates scores ≥ 1000 with the `3.1K` convention, and renders a horizontal arrow-number-arrow pill with no text label. Stops click propagation in its handlers.
- [ ] 1.4 Create `package/app/src/engagement/components/ReplyAction.tsx`. It takes `{ size, replyCount, mode: "count" | "label", onInvoke }`. `mode="count"` renders `💬 {count}` when `count > 0` else `💬 Reply`. `mode="label"` always renders `💬 Reply`. Dispatches `onInvoke` via a stopPropagation-wrapped handler.
- [ ] 1.5 Create `package/app/src/engagement/components/ShareAction.tsx` with the icon+label button plus a popover (MUI `<Menu>` or equivalent). Popover contents: "Copy link" (always) and "Share…" (only when `typeof navigator.share === "function"`). The button reads `getShareHref` from a `policy` prop.
- [ ] 1.6 Create `package/app/src/engagement/components/ShelfAction.tsx` with the icon+label button that opens `ShelfPickerModal` with the post's `targetId`. When unauthenticated, instead route through the existing sign-in prompt pathway.
- [ ] 1.7 Create `package/app/src/engagement/components/ShelfPickerModal.tsx`. Fetches `shelfKeys.mine()`, seeds selection from the collection-status query for the target, renders a checkbox list, a "Save" button wired to `useCollectMutation`, a "Cancel" button, and a reachable "Create new shelf" affordance that reuses the existing shelf-creation UI.
- [ ] 1.8 Create `package/app/src/engagement/components/OverflowMenu.tsx` — an MUI menu anchored to `⋯` that lists each overflow action as icon+label and dispatches the corresponding action token.
- [ ] 1.9 Rewrite `package/app/src/engagement/components/ReactionBar.tsx` so it accepts `{ size, actions, overflow, policy, post }` only. Deduplicate tokens between `actions` and `overflow` (visible wins). Render the enumerated atoms in the order listed; ignore unknown tokens; never render UI for `"funny"` or `"award"`. Call `event.stopPropagation()` at the bar wrapper level so parents do not have to.
- [ ] 1.10 Export `ReactionBar`, `ShelfPickerModal`, `VoteGroup`, `ReplyAction`, `ShareAction`, `ShelfAction`, `OverflowMenu`, and the `Action` / `ActionPolicy` types from `package/app/src/engagement/index.ts`.
- [ ] 1.11 Add Cosmos fixtures under `package/app/src/engagement/components/*.fixture.tsx` for each new atom and for `ReactionBar` at each of `sm` / `md` / `lg` with the three canonical action policies (content-as-artifact card, discussion card, thread-row).

## 2. Foundation: reply + thread primitives (Phase 1)

- [ ] 2.1 Create `package/app/src/post/forms/ReplyComposer.tsx` accepting `{ mode: "progressive" | "expanded", targetUnitId, parentId?, onSubmitted?, onCancelled? }`. Shape the progressive mode as a single-line MUI-style placeholder and the expanded mode as the existing editor with toolbar + Cancel/Post. Implement the blur-retain rule (collapse if empty body, retain if non-empty) in a single `useBlurRetain(body)` hook.
- [ ] 2.2 Implement `useFocusReplyFromQuery()` in `package/app/src/post/hooks/` that reads `?focus=reply` via TanStack Router's search, focuses the top progressive composer via a ref, then removes the query param without pushing history.
- [ ] 2.3 Create `package/app/src/post/components/parts/ThreadingRail.tsx` — an absolutely-positioned element inside a reply row's indent gutter. Props: `{ isCollapsed, onToggleCollapse }`. Paint a 2 px stroke; attach the `onClick` to a 12 px wide transparent hit-box element around the stroke. Hovering the hit-box applies `data-hovered="true"` to both the stroke and a sibling toggle icon.
- [ ] 2.4 Create `package/app/src/post/components/parts/CollapseToggle.tsx` — the `[−]` / `[+]` circle icon. Shares hover state with `ThreadingRail` through a small `useThreadingHover()` context scoped to the row.
- [ ] 2.5 Create `package/app/src/post/hooks/usePostTreeCollapse.ts` that owns per-tree collapse state (a `Map<postId, boolean>`), initialises `depth >= 2` as collapsed, and exposes `{ isCollapsed, toggleCollapse }` functions.
- [ ] 2.6 Update `PostReply.tsx` to (a) not call `useState` for collapse, (b) render `<ThreadingRail>` when `indentLevel > 0`, (c) render `<CollapseToggle>` when `directReplyCount > 0`, (d) accept `isCollapsed` / `onToggleCollapse` props passed down from `PostTreeSection` through `usePostTreeCollapse`.
- [ ] 2.7 Update `PostTreeSection.tsx` to (a) own collapse state via `usePostTreeCollapse`, (b) render children only when not collapsed, (c) inline-mount a new `<ReplyComposer mode="expanded">` as a row child when the section receives a reply-click for that row. Track open expanded composers in local state keyed by parent-post id.
- [ ] 2.8 Add Cosmos fixtures for `ReplyComposer` in both modes (empty / typed, focused / blurred), `ThreadingRail` (hovered / not), and `PostTreeSection` with a depth-3 mocked tree demonstrating default-collapse and multi-composer coexistence.

## 3. Migrate call sites per content type (Phase 2)

- [ ] 3.1 `post/components/item/PostCard.tsx`: replace any `PostReactionFooter` usage with `<ReactionBar size="md" actions={postCardActions} overflow={postCardOverflow} policy={postPolicy} />`. Add an outer `onClick` that navigates to `/post/:rootPostUnitId`. Verify in fixtures that clicking the footer does not navigate.
- [ ] 3.2 `post/components/parts/PostReply.tsx`: replace any `PostReactionFooter` with `<ReactionBar size="sm" actions={postReplyRowActions} overflow={postReplyRowOverflow} policy={postPolicy} />`. Reply-click on a reply row mounts an inline expanded `ReplyComposer` via the updated `PostTreeSection`.
- [ ] 3.3 `review/components/item/ReviewCard.tsx`: remove the placeholder "0 观看" text and add `<ReactionBar size="md" actions={reviewCardActions} ... />`. Standardise the outer `onClick` for detail-page navigation.
- [ ] 3.4 `review/components/detail/ReviewDetail.tsx`: replace `ReactionStatistics` with `<ReactionBar size="lg" actions={reviewDetailActions} ... />`. `ReviewDetailSection.tsx` adds `<ReplyComposer mode="progressive" targetUnitId={root.unitId} />` between the focal and the tree.
- [ ] 3.5 `remark/components/item/RemarkCard.tsx`: replace `PostReactionFooter` with `<ReactionBar size="md" actions={remarkCardActions} ... />`. The existing rating-badge link to the detail remains.
- [ ] 3.6 `remark/components/detail/RemarkDetail.tsx` and `RemarkDetailSection.tsx`: replace `PostReactionFooter` with `<ReactionBar size="lg" actions={remarkDetailActions} ... />` and add the top progressive `ReplyComposer`.
- [ ] 3.7 `excerpt/components/item/ExcerptCard.tsx`: remove the placeholder "0 likes" and add `<ReactionBar size="md" actions={excerptCardActions} ... />`.
- [ ] 3.8 `excerpt/components/detail/ExcerptDetail.tsx` and `ExcerptDetailSection.tsx`: replace `ReactionStatistics` with `<ReactionBar size="lg" ... />`; replace the existing `InlinePostForm` usage with `<ReplyComposer mode="progressive" ... />`.
- [ ] 3.9 `shelf/components/ShelfCard.tsx` (or equivalent): add `<ReactionBar size="md" actions={shelfCardActions} ... />` at the card footer with the content-as-artifact policy. Keep the outer navigation to `/shelf/:shelfId`.
- [ ] 3.10 Create per-feature policy helpers (`postPolicy`, `reviewPolicy`, `remarkPolicy`, `excerptPolicy`, `shelfPolicy`) under each feature's `models/` folder, each exporting its card / detail / row action arrays plus `getShareHref(post)` per `engagement-share-action`.
- [ ] 3.11 Formalise the click-propagation rule: every card migrated in 3.1–3.9 uses a single outer `onClick`; audit avatars / author headers / inline `<SafeLink>` usages inside each card and add `event.stopPropagation()` where they do not already have it.
- [ ] 3.12 Update the reply-click handler on every card in 3.1–3.9 so that the list-card reply behaviour navigates to the content's detail URL with `?focus=reply`.
- [ ] 3.13 Update `BookDiscussionPage` and any other current consumer of `ReplyDrawer` / inline reply openers so they stop opening a drawer and instead depend on `PostTreeSection`'s inline `ReplyComposer` (expanded mode).

## 4. Remove legacy (Phase 2 cleanup)

- [ ] 4.1 Delete `package/app/src/post/components/parts/PostReactionFooter.tsx`.
- [ ] 4.2 Delete `package/app/src/engagement/components/MiniActionBar.tsx` and migrate the `BookHero` call site to `<ReactionBar size="md" ... />` with the book-hero action policy (vote + shelf + share; reply is not applicable for a book target here — omit).
- [ ] 4.3 Delete `package/app/src/engagement/components/ReactionStatistics.tsx`. Verify all callers already migrated in section 3.
- [ ] 4.4 Delete `package/app/src/post/forms/InlinePostForm.tsx` (or wherever it currently lives). Verify all callers migrated to `ReplyComposer`.
- [ ] 4.5 Delete any `ReplyDrawer` / `ReplyModal` scratch implementations; grep `rg "ReplyDrawer|ReplyModal|reply-drawer|reply-modal"` under `package/app/` and confirm zero matches.
- [ ] 4.6 Grep `rg "PostReactionFooter|MiniActionBar|ReactionStatistics|InlinePostForm"` across the whole repo and confirm zero matches before closing the migration phase.

## 5. Shelf discussion mount (Phase 3)

- [ ] 5.1 Create `package/app/src/shelf/sections/ShelfDiscussionSection.tsx`. It composes `<ReplyComposer mode="progressive" targetUnitId={shelfUnitId} />` then `<PostTreeSection rootPostUnitId={shelfUnitId} mode="threaded" maxDepth={5} />` wrapped with an `EmptyState` when the tree query resolves to zero posts.
- [ ] 5.2 For unauthenticated visitors, `ShelfDiscussionSection` replaces the progressive composer with the same sign-in prompt pattern used by other detail-page composers.
- [ ] 5.3 Mount `<ShelfDiscussionSection shelfUnitId={shelf.unitId} />` at the bottom of `ShelfPage` (`package/app/src/shelf/pages/ShelfPage.tsx`), after the items list.
- [ ] 5.4 Add i18n keys for `shelf.discussion.empty.title` and any sign-in prompt copy introduced, alongside placeholder copy for the progressive composer (e.g. `shelf.discussion.composer.placeholder = "Start a discussion"`).
- [ ] 5.5 Add a Cosmos fixture for `ShelfDiscussionSection` demonstrating empty, populated (a handful of comment posts), and unauthenticated states.

## 6. Validation and cross-cutting checks

- [ ] 6.1 Run `bun run knip` at the repo root and confirm no newly-unused exports remain after the legacy deletions in section 4.
- [ ] 6.2 Run `bun tsc --noEmit` per affected package (`package/app`, `package/ui`, `package/api` if touched) and fix any regressions. Ignore cross-package path-alias errors per the repo's per-package TSC convention.
- [ ] 6.3 Run `bun run check:convention` to ensure no link-rendering, route, or folder-naming regressions were introduced by the migration.
- [ ] 6.4 Manually exercise in a browser: list → click card body → detail page; list → click footer vote → no navigation; list → click footer Reply → detail page opens with composer focused; detail page → click Reply on a depth-3 row → inline composer mounts with draft retention; collapse a subtree by clicking the threading rail; open the overflow menu on a thread card and confirm `Shelf` is reachable there.
- [ ] 6.5 Manually exercise `ShelfPickerModal` on at least one card from each content-as-artifact type: open the modal, multi-select two shelves, save, confirm the target appears in both shelves and that a second open of the modal shows both pre-checked.
- [ ] 6.6 Verify `FavoriteButton` remains functional on `BookHero` and any other current call site — no regression from this change.
- [ ] 6.7 Update the Cosmos fixtures index so all newly added fixtures are discoverable (`cosmos.config.json` reruns automatically, but spot-check the fixture tree once in the Cosmos UI).
