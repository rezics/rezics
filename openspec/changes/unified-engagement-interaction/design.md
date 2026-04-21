## Context

The app currently has four overlapping interaction footers living in three different folders:

- `package/app/src/engagement/components/ReactionBar.tsx` — the most complete one (vote, reply, favorite, collection, share) but used only by a single surface.
- `package/app/src/engagement/components/MiniActionBar.tsx` — a book-hero variant.
- `package/app/src/post/components/parts/PostReactionFooter.tsx` — the one actually rendered on `PostCard`, `PostReply`, `RemarkCard`, `RemarkDetail`. Only shows like count + reply count.
- `package/app/src/engagement/components/ReactionStatistics.tsx` — read-only counts used on `ReviewDetail` and `ExcerptDetailSection`.

Each content feature (`review`, `remark`, `excerpt`, `post`, `shelf`) then wires one of these into its own cards in its own way. `ReviewCard` and `ExcerptCard` have no reactive footer at all — they render a placeholder "0 观看" / "0 likes" string.

Reply composition is equally fragmented. `InlinePostForm` exists only as an "already expanded" editor mounted on `ReviewDetailSection` and `ExcerptDetailSection`. `PostReply` does not own an inline reply surface; its `onReply` callback is passed through `PostTreeSection` up to ad-hoc handlers (the `BookDiscussionPage` opens a `ReplyDrawer`; other surfaces do nothing). There is no threading-line visual and no `[−]` / `[+]` collapse toggle — indentation is the only visual clue for thread structure.

`ShelfPage` at `package/app/src/shelf/pages/ShelfPage.tsx` renders only the shelf's items; even though the backend already accepts posts with `targetUnitId = shelf.unitId`, they have nowhere to render.

`useCollectMutation` (`package/api/src/shelf/shelf.mutations.ts:282`) already handles the multi-shelf save action and returns `savedTo: shelfId[]`. No `ShelfPickerModal` UI exists to drive it; `FavoriteButton` drives the separate `useToggleFavoriteMutation` for one-click favorite-shelf behaviour.

The constraint landscape: `@rezics/ui` is MUI-first with shadcn supplements, links must route through `<SafeLink>`, the Jotai / Zustand split already governs most interactive state, and the feature-standard layout prohibits data fetching inside `components/`. Threading depth is already capped at `VISUAL_MAX_DEPTH = 4` by `post-presentation-architecture`, and the server returns `mode: "threaded"` with `maxDepth: 5`.

## Goals / Non-Goals

**Goals:**

- One `ReactionBar` component powers every content type's interaction footer on every surface (list card, detail page, thread row), distinguished only by `size` and the ordered `actions` array.
- Vote UI is Reddit-style: arrow + score + arrow pill, number-only, with label-free vote controls. Every other action renders with icon + text label so they read as distinct affordances rather than a row of anonymous icons.
- Reply composition uses one component, `ReplyComposer`, with a `mode` prop that selects either progressive disclosure (single-line placeholder, expand on focus — used only for the focal-post composer at the top of a detail page) or immediate full-editor rendering (used everywhere else a user clicks a 💬 Reply button).
- Thread UI adopts the Reddit pattern: vertical threading line between parent and children, `[−]` / `[+]` toggle on every row that owns children, both the toggle and the line clickable (widened hover hit-box), collapse state owned by `PostTreeSection`.
- `ShelfPage` mounts the same thread + composer stack as other detail pages, keyed on `shelf.unitId`.
- Click-propagation contract at the card level is standardised so cards remain navigation-clickable while interactive leaves (ReactionBar, author header, avatar, inline links) do not fire the outer navigation.

**Non-Goals:**

- `FavoriteButton` and the `collection/` feature are out of scope. The "favorite shelf" one-click shortcut continues to exist with its current `useToggleFavoriteMutation` wiring; reconciling or unifying it with the new `ShelfAction` is deferred to a future proposal.
- `funny` and `award` actions are reserved in the `ReactionBar` `Action` token union but no UI ships. The domain model for those reactions (schema, backend handling) is out of scope.
- In-site share destinations (e.g. direct-message forwarding) are out of scope. `ShareAction` only copies the link to the clipboard and, where supported, invokes the Web Share API.
- Backend contracts, Elysia routes, Prisma schema, and `@rezics/contract` types are unchanged.
- User profile / avatar interactions (hover card, click-to-profile) are **not** implemented here; the click-propagation rule is formalised in a way that makes their future addition trivial, but none ship in this change.

## Decisions

### D1: Two orthogonal props (`size` + `actions`) instead of named variants

`ReactionBar` takes two independent props rather than a single `variant="compact" | "expanded" | "thread-row"` enum. Rationale: the size axis (`sm` / `md` / `lg`) genuinely varies visual density, while the actions axis varies per content type even at the same size. A named-variant API would explode combinatorially (e.g. `"review-card-compact"` vs `"post-card-compact"`) or bury per-content policy inside the component.

Alternatives considered:
- **Single `variant` enum**: rejected — forces the component to know about content types, couples presentation and policy.
- **Variant enum + escape hatches**: rejected — the escape hatches always win, so the enum becomes dead weight.

Each content feature exports a small policy helper (e.g. `reviewCardActions`, `reviewDetailActions`, `postReplyRowActions`) that returns the action array. `ReactionBar` stays policy-free.

### D2: Action token union with reserved slots

The `Action` token type is:

```ts
type Action =
  | "vote"
  | "reply"
  | "share"
  | "shelf"
  | "more"
  | "funny"    // reserved, not rendered in this change
  | "award";   // reserved, not rendered in this change
```

`ReactionBar` simply ignores unknown or unimplemented tokens so that future proposals can start rendering `funny` / `award` without re-keying call sites.

The `"more"` token is not a single action — it expands into an overflow menu. Each content feature's action policy includes `"more"` at the end when any action is overflowed; the policy describes the overflow contents in the same array semantics (e.g. the thread-row policy returns `actions: ["vote", "reply", "share", "more"]` and `overflow: ["shelf", "report", "copy-link"]`).

Alternatives considered:
- **Flat array, no overflow concept**: rejected — forces every surface to either show all actions or drop them; overflow is the cleanest way to demote `shelf` on discussion contexts while keeping it discoverable.
- **Per-action boolean props**: rejected — order matters and would be awkward to express with bools.

### D3: Vote pill is its own atom and owns its own optimistic state

`VoteGroup` is a self-contained atom. It receives `(targetId, targetUnitId, score, myVote)` props and owns the `useToggleReaction` call internally; the parent `ReactionBar` does not proxy it. This matches how vote behaves across the web — it is latency-sensitive and rendering-local — and avoids threading optimistic state through every content feature.

All other actions (`ReplyAction`, `ShareAction`, `ShelfAction`) are "dumber" atoms that emit events up to their section; their work happens in dialogs or navigations, not inline.

Alternatives considered:
- **ReactionBar owns all mutations**: rejected — it would need generic knowledge of every action's mutation shape.
- **Everything emits events**: rejected — vote feels sluggish when the parent has to re-render to update the count.

### D4: `ReplyComposer` with a `mode` prop, no `ReplyModal`

`ReplyComposer` has modes `progressive` and `expanded`:

- `progressive` renders a single-line placeholder; focus expands it to a full editor with a toolbar and `Cancel` / `Post` buttons. On blur with empty body, it collapses back. This is used **only** on the top of a detail page where the user can decide independently whether to comment.
- `expanded` renders the full editor immediately. On blur with empty body, it still collapses and unmounts (because the user explicitly chose to open it). Any body content keeps it open.

Reply flow:
- Clicking 💬 on any **thread row** (inside a thread on any detail page, at any depth) inline-mounts a new `ReplyComposer` mode `expanded` as a sibling to that row's direct-reply list. No modal, no navigation — the thread stays in place. Multiple `expanded` composers may coexist across the tree; each follows the blur-retain rule independently.
- Clicking 💬 on the **focal post** of a detail page focuses and unfolds the top progressive composer. It does not mount a second composer.
- Clicking 💬 on a **list card** navigates to the content's detail page and hands off a `?focus=reply` search param; the detail page reads the param and auto-focuses the top progressive composer (which expands itself via its own focus handler).

Alternatives considered:
- **Reply dialog / drawer**: rejected — it breaks the "stay anchored in the current thread" feel and makes multi-composer editing awkward.
- **Always expanded, no progressive mode**: rejected — a permanently large empty editor on every detail page is visually heavy and encourages accidental drafts.

### D5: Threading line is a rendered element, not a CSS border

`PostReply` indents by `indentLevel * INDENT_PX`, but the vertical line connecting parent to children is a rendered `<span>` absolutely positioned inside each child row's indent gutter, not a left border on the row. Reason: we need the line itself to accept pointer events (widened hover hit-box, clickable to toggle collapse), which a CSS border cannot provide. The implementation uses a shared primitive `<ThreadingRail>` that renders the vertical segment and the L-bend to the row; hover styling makes its hit-box ~12 px wide while it paints only a 2 px stroke.

Alternatives considered:
- **Left border + wider `padding-left`**: rejected — cannot accept pointer events independently.
- **Overlay `<canvas>`**: rejected — way too heavy for what is essentially one vertical line per depth level.

### D6: Collapse state remains in `PostTreeSection`, the toggle and line are controlled

`post-presentation-architecture` already mandates that `PostReply` receives `isCollapsed` / `onToggleCollapse` as props and that the section owns the state. This change adds the visual elements (`[−]` / `[+]` circle + rail-click) that invoke `onToggleCollapse` but does not move state ownership. A new extracted hook `usePostTreeCollapse(rootPostUnitId)` centralises initial-collapse policy (depth >= 2) and provides the toggle function.

### D7: Card-level click-propagation contract

Every card becomes a clickable navigation target with a single `onClick` on the outer element. Interactive leaves (`<ReactionBar>`, `<PostAuthorHeader>` avatar / username, any inline `<SafeLink>`) call `event.stopPropagation()` in their own click handlers. This contract is documented in `engagement-reaction-bar` spec so future card authors follow it.

Rationale: the alternative — nested `<CardActionArea>` regions with exclusions — is error-prone and does not generalise to future interactive leaves (e.g. user avatars). A single outer `onClick` is easier to reason about and trivially extended by adding `stopPropagation` at new leaves.

### D8: ShelfAction opens a shared `ShelfPickerModal`; `useCollectMutation` is the backing call

`ShelfPickerModal` lists the user's shelves (from `shelfKeys.mine()`), allows multi-select, and on submit calls `useCollectMutation({ targetId, shelfIds })`. It pre-selects shelves the target is already in (derived from the collection-status query). The modal is a standalone component under `engagement/components/` and is not bound to any content type.

`useCollectMutation` already invalidates `shelfKeys.mine()` and each affected `shelfKeys.detail` / `shelfKeys.items`, so no extra cache wiring is needed.

### D9: ShelfPage mounts the thread stack as a new top-level section

`ShelfPage` gains a `<ShelfDiscussionSection shelfUnitId={shelf.unitId} />` at the bottom, which composes the progressive `ReplyComposer` + `PostTreeSection` + existing empty-state primitive. No changes to shelf's data model; the section simply reuses the existing post APIs.

## Risks / Trade-offs

- **Event-propagation regressions when migrating cards** → every card that currently relies on nested clickable regions becomes a single outer `onClick` + `stopPropagation` leaves. **Mitigation**: each migrated card has a Cosmos fixture exercising "click body navigates", "click footer does not navigate", "click avatar does not navigate". Fixtures should be added as part of the per-card migration task.
- **Threading rail hover hit-box interferes with text selection** → making the rail hit-box ~12 px wide could swallow mouse-down on nearby text. **Mitigation**: the hit-box sits inside the indent gutter, which is itself empty of text; the rail does not extend into the content column. Also, the collapse action is `onClick` (not `onMouseDown`) so text selection starting in the rail area still works if the user drags.
- **Multiple concurrent `ReplyComposer` instances losing draft state** → users may open several and forget. **Mitigation**: the blur-retain rule (keep open if there is body content) means a composer never vanishes silently. A future enhancement (out of scope) could persist drafts to `localStorage`; for now, the retain rule is enough.
- **`PostReactionFooter` removal breaks any out-of-tree import** → the codebase is a monorepo with no external consumers of `@/post/parts/*`, so this is only an in-repo mechanical rename. **Mitigation**: grep for `PostReactionFooter` before archiving and ensure zero remaining references.
- **Progressive composer's focus-param handshake is fragile** → if the list card navigates with `?focus=reply` but the detail page does not implement the handler, the user sees a non-focused composer. **Mitigation**: the handler is centralised in a `useFocusReplyFromQuery()` hook used by every detail page; `post-reply-composer` spec mandates it.
- **`funny` / `award` enum reservation invites scope creep** → developers may see the token and start rendering UI. **Mitigation**: the spec explicitly forbids rendering them in this change, and the token union comments call out "reserved, do not render".
- **Overflow-menu discoverability** → demoting `Shelf` to `[⋯]` on discussion contexts may reduce save-rate. **Mitigation**: the policy is content-type-driven (content-as-artifact types keep it visible), and the rule is reversible in a future proposal without refactoring.

## Migration Plan

The change is landed as a single proposal but implemented in three phases (see `tasks.md` for the task-level breakdown):

1. **Phase 1 — Build the primitives.** New files only. Land `engagement/components/ReactionBar.tsx` (rewritten), `VoteGroup`, `ReplyAction`, `ShareAction`, `ShelfAction`, `OverflowMenu`, `ShelfPickerModal`, `ReplyComposer`, `ThreadingRail`, `usePostTreeCollapse`. No call sites change yet; existing surfaces keep using the old atoms. All new files ship with Cosmos fixtures.
2. **Phase 2 — Migrate call sites.** Each content feature (`post`, `review`, `remark`, `excerpt`, `shelf card`) gets a commit that swaps its old atoms for the new `ReactionBar` and `ReplyComposer`. Old atoms are deleted at the end of this phase after grep confirms zero references.
3. **Phase 3 — Mount shelf discussion.** Add `ShelfDiscussionSection` and wire it into `ShelfPage`. Update `review-remark-ux` and `post-presentation-architecture` archived specs to reference the new capabilities.

Rollback: because the change is code-only (no data migration, no API change), rolling back is `git revert` of the Phase-2 migration commit. Phase 1 can stay landed independently since it does not affect any existing surface.

## Open Questions

- **Overflow menu divider grouping**: should the overflow menu group related actions (e.g. `Shelf` and `Save` separated by a divider from `Report` and `Copy link`)? Deferred until the menu gets a third item beyond what this change introduces.
- **Vote pill orientation at `size="sm"`**: Reddit uses a horizontal pill at comment-row density. We adopt horizontal for `sm` and `md`; `lg` may use a vertical orientation if the detail header has extra vertical room. Decide during Phase 1 fixture work — both layouts need to live behind the same `<VoteGroup>` atom.
- **`Web Share API` fallback UI on desktop browsers without support**: current plan is copy-link + small toast. If the user base is primarily on desktop, the native share sheet may never fire. Decide during Phase 1 while building `ShareAction`.
- **Share attribution**: if a user shares a review's link from inside a reply-row ReactionBar, the link should point to the reply's own detail page (not the review's). The `share` action's copy-link URL comes from the policy helper's `getDetailHref(post)` accessor — confirm this matches each content's route during Phase 2 migration.
