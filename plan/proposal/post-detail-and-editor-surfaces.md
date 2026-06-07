---
title: Post Detail and Editor Surfaces
status: active
created: 2026-06-07
completed:
supersededBy:
tags: [post, realm, review, editor, ui]
---

## Why

Realm post detail pages currently reuse the feed-oriented `PostCard`, so a page
opened at `/realm/:realmId/post/:postUnitId` renders like a preview item:
clickable card chrome, clamped body/title, and little visible realm context.
The intended outcome is a real post detail surface: full content rendering,
realm-aware context, stable reaction/comment scope, and no preview collapse.

Post-like editor surfaces are also fragmented. `RootPostTranslationEditor`
already carries language-aware post editing, review edit reuses it only in the
update path, realm post creation has its own title/body/language handling, and
plain post edit still uses `Input + textarea`. The intended outcome is a shared
post editor core that ordinary posts, realm posts, wiki posts, and reviews can
extend without losing their domain-specific controls.

## Durable constraints & decisions

- `(test)` Realm-context post detail routes keep realm-scoped reactions and
  comments by using `realmReactionScopeKey(realmUnitId)` for the root post,
  reply composer, and comment thread.
- `(test)` The post detail renderer does not clamp title or markdown body. Feed
  preview clamping stays in `FeedCard`/`PostCard`, not in the detail surface.
- `(test)` Opening a realm post detail with a known `realmId` displays realm
  context from `realmDetailQuery` or an equivalent typed realm-context query;
  do not depend on `PostDTO.realmUnitId` alone for title/slug copy.
- `(comment)` Keep the detail surface separate from preview cards because card
  click navigation and truncation are preview behavior, not thread behavior.
- `(type)` If a detail context model is introduced, carry it as an explicit
  typed shape such as `PostDetailContext = direct | realm`, not ad hoc nullable
  props.
- `(test)` `PostEditPage` uses the same language-aware editor core as review edit
  and wiki editing, so changing translations does not require a separate
  textarea-only path.
- `(test)` Realm post creation uses the shared post editor core for title,
  markdown body, language, submit/cancel wiring, and validation, while keeping
  realm-only extensions for tags, polls, rule/approval copy, and destination
  navigation.
- `(test)` Review create and edit extend the shared post editor core with rating,
  target-unit context, score-entry behavior, and publish validation. Review
  should not define a parallel markdown editor path unless the post core is
  unavailable by design.
- `(comment)` Domain extensions belong around the post editor core as slots or
  small adapters; the core should not import realm or review feature modules.
- `(type)` Shared editor mode/value sets, if added, should be TypeScript values
  owned by `package/app/src/post/models` or post form props, not stringly
  scattered across review and realm code.

## 1. Post Detail Surface

- [x] 1.1 Add a post detail presentation component under
  `package/app/src/post/components/detail/` that renders author, title, full
  markdown body, poll embeds, variant context, and reactions without whole-card
  click behavior or preview clamps.
- [x] 1.2 Move shared post action/reaction wiring needed by both `PostCard` and
  the new detail component into a small post-local helper if direct duplication
  would make policies diverge.
- [x] 1.3 Update `package/app/src/post/pages/PostThreadPage.tsx` to render the
  new detail component instead of `PostCard`, preserving edit entry behavior,
  reply focus behavior, and `CommentThreadSection` props.
- [x] 1.4 Add a realm context header/strip for realm post detail pages, querying
  realm title/slug through `realmDetailQuery` or a typed equivalent when
  `realmUnitId` is present.
- [x] 1.5 Ensure direct `/post/:rootPostUnitId`, id-based realm routes, and slug
  routes (`/r/:realmSlug/post/:postUnitId`) all resolve the same detail context
  and canonical reaction/comment scope.
- [x] 1.6 Add focused Storybook coverage for the post detail component, including
  long markdown content, poll embed placeholder behavior, and realm context.

## 2. Shared Post Editor Core

- [x] 2.1 Promote `RootPostTranslationEditor` into a shared post editor core or
  wrap it with a clearer surface component in `package/app/src/post/forms/`,
  keeping language selection, title input, markdown editor, submit/cancel, and
  extra action slots together.
- [x] 2.2 Add or update post editor model tests for language draft switching,
  fallback language seeding, and draft preservation when switching languages.
- [x] 2.3 Update `package/app/src/post/pages/PostEditPage.tsx` to use the shared
  editor core instead of a raw textarea, while preserving wiki locked-field error
  handling and ordinary post update semantics.
- [x] 2.4 Keep wiki editing on the shared core through
  `package/app/src/post/forms/WikiPostEditor.tsx`; adjust only the wrapper props
  needed by the new core shape.
- [x] 2.5 Update `package/app/src/post/index.ts` exports so external feature
  consumers use the supported post editor/detail surfaces rather than reaching
  into internal files.

## 3. Realm Authoring Integration

- [x] 3.1 Refactor `package/app/src/realm/components/RealmPostCreateForm.tsx` to
  use the shared post editor core for title/body/language state and validation.
- [x] 3.2 Keep realm-only controls in the realm feature: `RealmPostTagPicker`,
  poll attach/create flow, approval messaging, and navigation to either the
  realm feed or realm post detail after publish.
- [x] 3.3 Ensure `buildRealmPostCreateInput` remains the single model boundary
  for realm create payload shape, with tests updated only if the shared editor
  changes its value model.
- [x] 3.4 Confirm `RealmCreatePage` continues to compose modes (`post`, `wiki`,
  `poll`, `existing`) without importing review-specific behavior.

## 4. Review Authoring Integration

- [x] 4.1 Update `package/app/src/review/forms/ReviewForm.tsx` so create and
  update paths both extend the shared post editor core, rather than using
  `RezicsMarkdownEditor` directly when no existing `post` is passed.
- [x] 4.2 Keep rating controls, 200-character publish validation, and review
  primary/secondary actions in the review feature as extensions around the post
  editor core.
- [x] 4.3 Update `ReviewNewPage` to pass an initial/default language into the
  review form so create mode gets the same language behavior as edit mode.
- [x] 4.4 Keep score-entry creation and target/variant routing in
  `ReviewNewPage`; the shared post editor core should not know review scoring.
- [x] 4.5 Update review form stories to cover create and update modes with the
  shared language-aware editor controls.

## 5. Verification

- [x] 5.1 Run focused unit tests for post editor language models and realm create
  payload models.
- [ ] 5.2 Run focused component/story tests where available for `post`, `realm`,
  and `review` editor/detail surfaces.
- [x] 5.3 Run `bun run check:convention` to confirm feature boundary and export
  rules still pass.
- [ ] 5.4 Manually verify direct post detail, realm id post detail, and realm
  slug post detail after `bun run dev`, confirming full body rendering, realm
  context display, reaction scope, reply composer, and comments.
- [ ] 5.5 Manually verify post edit, realm create post, review create, and review
  edit all expose language-aware editing and keep their domain-specific controls.

## Out of scope

- Changing server post creation/update semantics, moderation policy, or Drizzle
  schema.
- Reworking TanStack Query cache invalidation or editor feedback behavior already
  covered by `post-authoring-cache-coherence-and-feedback.md`.
- Redesigning the full realm feed, feed card layout, review detail page, or
  comment thread UI beyond the post detail/editor surfaces described here.
- Adding browser automation or downloading browsers; manual verification URLs
  are enough unless explicitly requested.
- Introducing a parallel spec corpus. Durable behavior should land in types,
  tests, and small code comments during apply.
