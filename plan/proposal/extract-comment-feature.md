---
title: Extract a standalone `comment` feature from `post`
status: done
created: 2026-06-06
completed: 2026-06-06
supersededBy:
tags: [app, comment, post, refactor]
---

## Why

The backend already treats comment and post as distinct concepts — separate
contract types (`CommentDTO` vs `PostDTO`, with a test asserting "does not expose
comment topology on PostDTO"), separate server domains (`comment.*` vs `post.*`),
separate DB tables (`Comment` with an `ltree` path vs `Post`), and separate Unit
types (`COMMENT` vs `POST`). The frontend app is the only layer that never drew
the line: all comment-thread UI lives inside `package/app/src/post/`, and every
piece is misnamed `PostTree*` / `PostReply` even though it reads `commentListQuery`
and renders `CommentDTO`.

This change extracts a standalone `package/app/src/comment/` feature that owns the
comment-thread UI (tree, threading rail, reply composer, promotions), and reduces
`post` to real post content (post cards, post feed, post editors, post metadata).
After this, **`post` becomes an ordinary consumer of the comment thread, exactly
like `review` / `remark`**: `PostThreadPage` renders `PostCard` + the comment
feature's thread section, the same way `ReviewDetailSection` does.

This is a **frontend-only** refactor. Contract, server, and DB are untouched. The
`@rezics/api/comment/comment` query namespace already exists and is reused as-is.

## Durable constraints & decisions

- The new feature is named `comment` to mirror the backend domain and the
  `@rezics/api/comment` namespace 1:1. `(comment)` in `comment/index.ts` header.
- `comment` is a **leaf thread feature** consumed by `post`, `review`, `remark`,
  `excerpt`, `poll`, `shelf`, `book-library`, `book-read-node`. It must not know
  anything post-specific (no `PostCard`, no `postQueries`, no post routes). `(test)`
  worth a lightweight import-direction guard if one exists; otherwise `(comment)`.
- **`PostListSection` is a post feed** (`postQueries.list` → `PostCard`), NOT a
  comment view. It stays in `post`. Consumers that use it keep importing it from
  `post`; only their `ReplyComposer` / `useFocusReplyFromQuery` imports move to
  `comment`. `(comment)` on `PostListSection`.
- **Shared display atoms `PostAuthorHeader` and `PostBodyMarkdown` stay in `post`**
  and are imported by `comment` (and already by `review` / `remark`). They accept
  both `PostDTO` and `CommentDTO` shapes (they only read author + contentDoc). This
  creates a `post` ↔ `comment` bidirectional feature edge, which is acceptable and
  consistent with the existing `post` ↔ `poll` edge (`PostReply` imports `@/poll`'s
  `PollEmbed`; `poll` imports `post`'s `ReplyComposer`). Promoting these atoms to a
  neutral shared home is explicitly out of scope (see below). `(comment)` at the
  import sites in `comment`.
- **URL/query contract names are NOT renamed.** The `focusPostUnitId` search param
  and the `/post/$rootPostUnitId/continue/$unitId` route shape stay as-is so
  existing links keep working. Renaming them is out of scope. `(comment)` where a
  component still surfaces `focusPostUnitId`.
- `postPolicy.ts` is split by concern: the reply-row action sets
  (`postReplyRowActions`, `postReplyRowOverflow`) move to `comment` (renamed
  `commentRowActions` / `commentRowOverflow`); the post-card/detail action sets,
  `getPostShareHref`, and `postPolicy` stay in `post`. Comment share-href behavior
  is preserved (reuse `getPostShareHref` from `post` — comment permalinks resolve
  under `/post/...`). `(comment)` noting why comment reuses the post share href.
- Renames are clear cutovers: every internal callsite is updated in the same change
  (per AGENTS.md). Component/file/symbol renames below are mandatory; renaming
  in-function locals that hold comments but are named `posts`/`post` is desirable
  cleanup but must not cross a query/route contract.

### Move map (→ `package/app/src/comment/`)

Rename on move:
- `sections/PostTreeSection.tsx` → `sections/CommentThreadSection.tsx` (+ `.test.ts`, `.stories.tsx`)
- `sections/PostTreeList.tsx` → `sections/CommentTreeList.tsx`
- `sections/PostTreeNode.tsx` → `sections/CommentTreeNode.tsx`
- `sections/PostTreeRail.tsx` → `sections/CommentTreeRail.tsx`
- `sections/postTreeLayout.ts` → `sections/commentTreeLayout.ts`
- `components/item/PostReply.tsx` → `components/item/CommentReply.tsx` (+ `.stories.tsx`)
- `components/parts/PostPromotionControls.tsx` → `components/parts/CommentPromotionControls.tsx` (+ `.stories.tsx`)
- `hooks/usePostTreeCollapse.ts` → `hooks/useCommentTreeCollapse.ts` (+ `.test.ts`)
- `models/postTreeRails.ts` → `models/commentTreeRails.ts`
- `models/postPromotionGate.ts` → `models/commentPromotionGate.ts` (+ `.test.ts`)

Move as-is:
- `components/parts/ThreadingRail.tsx` (+ `.stories.tsx`)
- `components/parts/ThreadingContext.tsx` (+ `.stories.tsx`)
- `components/parts/CollapseToggle.tsx` (+ `.stories.tsx`)
- `components/parts/CommentPromotionBadge.tsx`
- `forms/ReplyComposer.tsx` (+ `.stories.tsx`)
- `hooks/useFocusReplyFromQuery.ts`
- `pages/ContinueThreadPage.tsx` (pure comment today; route import re-points to `@/comment/pages`)

New:
- `models/commentPolicy.ts` (the reply-row action sets extracted from `postPolicy`)
- `comment/index.ts` (public API)

### Stays in `package/app/src/post/`

- `components/item/PostCard.tsx`, `components/parts/PostAuthorHeader.tsx`, `components/parts/PostBodyMarkdown.tsx`
- `forms/PostEditDialog.tsx`, `forms/WikiPostEditor.tsx`, `forms/RootPostTranslationEditor.tsx`
- `models/postMetadata.ts`, `models/postPolicy.ts` (trimmed), `models/postThreadContext.ts`, `models/rootPostTranslationEditorLanguages.ts`
- `sections/PostListSection.tsx`
- `pages/PostThreadPage.tsx` (now composes `comment`), `pages/PostEditPage.tsx`

## Tasks

### 1. Scaffold the comment feature
- [x] 1.1 Create `package/app/src/comment/` with `components/{item,parts}`, `sections`, `forms`, `hooks`, `models`, `pages` subfolders following `package/app/docs/feature standard.md`.
- [x] 1.2 Add `comment/index.ts` exporting the public surface: `CommentThreadSection`, `ReplyComposer` (+ `ReplyComposerHandle`, `ReplyComposerMode`, `ReplyComposerProps`, `useBlurRetain`), `useFocusReplyFromQuery`, `useCommentTreeCollapse` (+ `filterByPathPrefix`, `seedCollapsedIds`), `CommentReply`, and `commentRowActions` / `commentRowOverflow` if consumed externally.

### 2. Move + rename the thread UI into comment
- [x] 2.1 Move and rename the section files (`PostTreeSection`→`CommentThreadSection`, `PostTreeList`→`CommentTreeList`, `PostTreeNode`→`CommentTreeNode`, `PostTreeRail`→`CommentTreeRail`, `postTreeLayout`→`commentTreeLayout`), updating intra-file symbol names and relative imports.
- [x] 2.2 Move `ThreadingRail`, `ThreadingContext`, `CollapseToggle`, `CommentPromotionBadge` as-is; move+rename `PostReply`→`CommentReply` and `PostPromotionControls`→`CommentPromotionControls`. `CommentReply` imports `PostAuthorHeader`/`PostBodyMarkdown` from `@/post` and `PollEmbed` from `@/poll`.
- [x] 2.3 Move `ReplyComposer` and `useFocusReplyFromQuery` as-is; move+rename `usePostTreeCollapse`→`useCommentTreeCollapse`.
- [x] 2.4 Move+rename `postTreeRails`→`commentTreeRails` and `postPromotionGate`→`commentPromotionGate` (with tests).
- [x] 2.5 Create `comment/models/commentPolicy.ts` with `commentRowActions`/`commentRowOverflow` (from `postReplyRowActions`/`postReplyRowOverflow`); reuse `getPostShareHref`/`postPolicy` from `@/post` for share behavior.
- [x] 2.6 Move `ContinueThreadPage.tsx` into `comment/pages/` (it is already pure comment); fix its relative imports to the moved siblings.

### 3. Trim the post feature
- [x] 3.1 Remove `postReplyRowActions`/`postReplyRowOverflow` from `post/models/postPolicy.ts`; keep post-card/detail sets, `getPostShareHref`, `postPolicy`. Update the file's header comment to drop the "discussion comments" framing.
- [x] 3.2 Update `post/index.ts` to drop the moved exports (`PostTreeSection`, `PostReply`, `ReplyComposer` + types, `useFocusReplyFromQuery`, `usePostTreeCollapse` + helpers, reply-row actions) and keep post-only exports (`PostCard`, `PostAuthorHeader`, `PostBodyMarkdown`, `PostEditDialog`, `RootPostTranslationEditor`, `WikiPostEditor`, `postPolicy` set, `PostListSection`).
- [x] 3.3 Rewrite `post/pages/PostThreadPage.tsx` to import `CommentThreadSection`, `ReplyComposer`, `useFocusReplyFromQuery` from `@/comment` (post content + `postThreadContext` stay).

### 4. Re-point consumers
- [x] 4.1 `review/sections/ReviewDetailSection.tsx`: `PostTreeSection`→`@/comment` `CommentThreadSection`; `ReplyComposer`, `useFocusReplyFromQuery`→`@/comment`. `PostAuthorHeader`/`PostBodyMarkdown` in review cards stay on `@/post`.
- [x] 4.2 `remark/sections/RemarkDetailSection.tsx`: same re-point as review.
- [x] 4.3 `excerpt/sections/ExcerptDetailSection.tsx`, `poll/pages/PollPage.tsx`, `book-library/pages/BookDiscussionPage.tsx`, `book-read-node/components/EmptyNodeView.tsx`, `shelf/sections/ShelfDiscussionSection.tsx`: keep `PostListSection` on `@/post`; move `ReplyComposer` / `useFocusReplyFromQuery` to `@/comment`.
- [x] 4.4 `routes/_mainLayout/post/$rootPostUnitId/continue.$unitId.tsx`: import `ContinueThreadPage` from `@/comment/pages/ContinueThreadPage`. (`PostThreadPage` routes stay on `@/post`.)

### 5. Verify
- [ ] 5.1 `bun run knip` (no dangling exports/deps), `bun run check:convention`, `bun run format:check`.
  Left unchecked because `format:check` and `check:convention` pass, but
  `bun run knip` still reports broad repo-wide unused exports/deps outside this
  proposal.
- [x] 5.2 `bun --filter=@rezics/app test` for the moved tests (`CommentThreadSection`, `useCommentTreeCollapse`, `commentPromotionGate`) and `postThreadContext`/`postMetadata` still in post.
- [x] 5.3 Confirm Storybook ids/titles for moved stories reflect the `comment` feature.

## Out of scope

- Promoting `PostAuthorHeader` / `PostBodyMarkdown` to a neutral shared home
  (`@/components` or `@rezics/ui`). They stay in `post`; revisit if the
  `post` ↔ `comment` edge becomes a problem.
- Renaming URL search params (`focusPostUnitId`) or route param/path shapes.
- Any contract, `@rezics/api`, server, or DB changes — those layers are already
  split.
- Renaming `PostListSection` or the `ContinueThreadPage` route component name.
