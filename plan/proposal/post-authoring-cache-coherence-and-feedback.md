---
title: Post Authoring Cache Coherence and Feedback
status: active
created: 2026-06-07
completed:
supersededBy:
tags: [post, api, react-query, editor, feedback]
---

## Why

Editing a post can return users to stale content because post mutations only
write the unparameterized post detail cache and invalidate the unscoped post
list namespace. Reader surfaces often consume language-aware post detail keys,
while editor surfaces also consume `unitQueries.languageContent(...)`, so a
successful save can leave both the view page and the next edit session reading
old cached data until a manual invalidation or full refresh occurs.

Post lists have the same shape of problem. The app has multiple post list
namespaces (`list`, `target`, `variant`, `realm`, `author`) and many filter/sort
combinations, especially latest-style ordering. The intended outcome is a
shared post mutation cache contract in `@rezics/api`: detail caches are updated
where exact data is known, broad affected prefixes are invalidated where list
membership or ordering may change, and editor save/submit actions always give
visible success or failure feedback.

## Durable constraints & decisions

- `(test)` A successful post content update invalidates every cached detail
  variant for the post, including language-aware `postKeys.detail(unitId, query)`
  entries, not only the exact unparameterized detail key.
- `(test)` A successful post content update invalidates the unit language-content
  namespace for the same unit so editor forms seeded from
  `unitQueries.languageContent(...)` cannot reopen with stale text.
- `(test)` Post list invalidation is prefix/domain based. Do not manually patch
  or reorder latest lists after content edits; list membership and ordering can
  depend on filters, moderation state, language, realm, target, variant, and
  timestamps.
- `(comment)` The post mutation cache helper should document why scoped list
  prefixes are deliberately over-invalidated. The tradeoff is extra background
  refetches instead of fragile per-sort cache surgery.
- `(test)` Caller `onSuccess` work that navigates away from an editor runs only
  after the shared cache sync helper has completed its synchronous cache writes
  and awaited required invalidations.
- `(test)` Create, update, publication, submit-to-realm, state-change, and delete
  post mutations keep their existing draft/comment invalidation behavior while
  adopting the shared post cache sync path.
- `(test)` Editor save/submit controls provide a visible outcome: success either
  navigates to the canonical view page or shows a toast/inline notice; failure
  surfaces an inline error or toast instead of appearing inert.
- `(type)` If an editor feedback helper is introduced, its mode should be an
  explicit small value set such as `navigate` vs `toast`, carried in TypeScript
  rather than prose.

## 1. API Cache Coherence

- [x] 1.1 Add post mutation cache sync helpers in
  `package/api/src/post/post.mutations.ts`, using existing key factories from
  `post.keys.ts` and `unit.keys.ts` rather than inline query keys.
- [x] 1.2 Make the helper update the exact unparameterized post detail cache
  when a `PostResponse` is available, then invalidate `postKeys.details()` so
  language-aware detail variants refetch.
- [x] 1.3 Make the helper invalidate `unitKeys.languages(unitId)` so all
  `unitKeys.languageContent(unitId, query)` editor-source variants refetch.
- [x] 1.4 Make the helper invalidate affected list namespaces by prefix:
  `postKeys.lists()`, plus target, variant, realm, and author prefixes when the
  returned post or mutation variables expose those ids.
- [x] 1.5 Route `useCreatePostMutation`, `useCreateWikiPostMutation`,
  `useUpdatePostMutation`, `useUpdateWikiPostContentMutation`,
  `useDeletePostMutation`, `useSetPostPublicationMutation`,
  `useSubmitPostToRealmMutation`, and `useSetPostStateMutation` through the
  helper while preserving draft and comment-thread invalidation already present
  in the file.

## 2. API Tests

- [x] 2.1 Add `package/api/src/post/post.mutations.test.ts` covering cache sync
  behavior with an isolated `QueryClient`, following the style of
  `unit.mutations.test.ts` and `reaction.mutations.test.ts`.
- [x] 2.2 Test that both `postKeys.detail(unitId)` and
  `postKeys.detail(unitId, { languages: [...] })` are stale or updated as
  intended after an update sync.
- [x] 2.3 Test that `unitKeys.languageContent(unitId, { appLocale: ... })` is
  invalidated via the `unitKeys.languages(unitId)` prefix.
- [x] 2.4 Test that latest/list variants under `postKeys.lists()`,
  `postKeys.byTargets(targetUnitId)`, `postKeys.byRealms(realmUnitId)`, and
  `postKeys.byAuthors(authorUserId)` are invalidated by prefix.
- [x] 2.5 Test that caller `onSuccess` observes cache writes before it runs, so
  editor navigation cannot race ahead of the helper's local cache sync.

## 3. Editor Feedback

- [x] 3.1 Audit post-like editor callers in `package/app/src/post`,
  `package/app/src/review`, and `package/app/src/remark` that use
  `useCreatePostMutation`, `useUpdatePostMutation`, or
  `useUpdateWikiPostContentMutation`; classify each as canonical-view navigation
  or stay-in-place toast/inline feedback.
- [x] 3.2 Update `package/app/src/post/pages/PostEditPage.tsx` so successful
  saves navigate only after mutation cache sync and failures always surface a
  visible error; keep locked-field errors inline.
- [x] 3.3 Update dialog/editor surfaces in `package/app/src/post/forms/` so
  update success and failure feedback is visible even when the dialog closes or
  remains open.
- [x] 3.4 Update review/remark editor surfaces that reuse post mutations so they
  follow the same visible feedback contract without changing their route model.
- [x] 3.5 Where buttons are disabled by validation, add or reuse local inline
  validation/policy-denial messaging so save/submit does not appear inert when
  required fields are missing.

## 4. Verification

- [x] 4.1 Run focused API tests for post/unit cache helpers with `bun test` from
  `package/api` or the equivalent filtered command.
- [x] 4.2 Run `bun run check:convention` to confirm query key changes respect the
  repo rule that app/admin/ui do not inline query key arrays.
- [ ] 4.3 Manually verify the authoring flow: edit a post, save, return to the
  post view without a full refresh, confirm the body is current, open edit again,
  confirm the editor body is current, and confirm relevant latest/scoped lists
  refresh.

## Out of scope

- Replacing TanStack Query with a normalized entity store or TanStack DB.
- Reworking server post update semantics, timestamps, indexing, or Meili sync.
- Building realtime invalidation across browser tabs or users.
- Changing route structure for post/review/remark canonical pages.
- Hand-authoring broad UI redesigns beyond save/submit feedback and validation
  affordances needed by this authoring flow.
