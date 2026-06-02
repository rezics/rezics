---
title: Realm Create Page
status: active
created: 2026-06-02
completed:
supersededBy:
tags: [realm, post, poll, draft, app]
---

## Why

Realm authoring has outgrown the current modal composer. The realm header opens a dialog that embeds `ReplyComposer`, which can only create a basic `PostKind.POST` in the current realm, with an optional embedded poll. A realm create flow needs a page-level surface because publishing into a realm spans several distinct workflows: creating a new feed post, creating a wiki-style post, creating a poll post, and publishing or sharing an existing post/draft into the realm.

The intended outcome is a canonical `/realm/$realmId/create` page that becomes the home for realm-scoped authoring decisions. The realm page should link to that page instead of opening a modal, and the implementation should keep domain rules in their natural homes: post creation and publication in `post`, realm feed membership in `realm`, draft recovery in `draft`, poll composition in `poll`, and route wiring under `routes`.

## Durable constraints & decisions

- (type) Realm create mode is a first-class app model, not an overloaded `ReplyComposer` prop. It must distinguish at least `post`, `wiki`, `poll`, and `existing` so each workflow can own its required fields.
- (comment) `ReplyComposer` remains a lightweight inline composer for replies and simple contextual posts. The page-level realm create flow must not turn it into the owner of wiki, draft publishing, or existing-content submission.
- (test) Creating a new post from the realm create page must pass `realmUnitIds: [realmId]`, selected `tagIds`, `kind: POST`, and the chosen publication status.
- (test) Creating a wiki from the realm create page must pass `realmUnitIds: [realmId]`, `kind: WIKI`, language/content, and the chosen publication status; wiki content translation behavior remains owned by the post server path.
- (test) Creating a poll post from the realm create page must mint the poll first, then create a `POST` in the realm with `extra.poll.unitId`; orphan poll tolerance follows the existing attach-poll behavior.
- (type) Publishing existing content into a realm is not the same operation as realm management "add content". The API shape must name the actor intent explicitly, for example author/member submission of an existing post to a realm.
- (test) The existing-content flow must not use `/realm/:unitId/content` as-is for ordinary member publishing, because that route currently checks realm update permission rather than realm post permission.
- (test) Publishing a draft into a realm must attach the realm before or during publication so the post appears in the realm feed after publish and respects the same realm posting rule acknowledgement checks as new post creation.
- (comment) Canonical routing is `/realm/$realmId/create`; slug routes under `/r/$realmSlug/create` may redirect later, but the implementation should not duplicate authoring state across slug and id routes.
- (test) The realm page create button must navigate to `/realm/$realmId/create` for members and keep the non-member disabled/join prompt behavior.

## 1. Route And Page Shell

- [x] 1.1 Add `package/app/src/routes/_mainLayout/realm/$realmId/create.tsx` that reads `realmId` from params and renders a realm create page component.
- [x] 1.2 Add `package/app/src/realm/pages/RealmCreatePage.tsx` as the page-level coordinator: fetch realm detail/membership, enforce member-only authoring UI, and host mode selection.
- [x] 1.3 Update `package/app/src/realm/pages/RealmPage.tsx` so the member create action is a link to `/realm/$realmId/create` instead of a dialog.
- [x] 1.4 Remove the realm create dialog state and dialog-only imports from `RealmPage.tsx`.
- [ ] 1.5 Export `RealmCreatePage` from `package/app/src/realm/index.ts` only if route lazy loading or nearby code needs the public feature entry.

## 2. Realm Create App Model

- [x] 2.1 Add `package/app/src/realm/models/realmCreateMode.ts` with the mode union and small helpers for labels/default mode.
- [x] 2.2 Keep the model free of React, hooks, API clients, and state modules according to the app feature layering rule.
- [x] 2.3 Add focused tests for the mode helpers in `package/app/src/realm/models/realmCreateMode.test.ts`.

## 3. New Post Workflow

- [x] 3.1 Add a page-owned post form component under `package/app/src/realm/components/RealmPostCreateForm.tsx` or a similarly scoped path.
- [x] 3.2 Reuse the existing markdown editor and realm tag picker logic where practical, but move shared realm tag selection out of `ReplyComposer` if the page and composer both need it.
- [x] 3.3 Support save draft and publish actions through `useCreatePostMutation`, passing `realmUnitIds`, `tagIds`, `kind: PostKind.POST`, `content`, and `status`.
- [x] 3.4 Navigate to the created realm post route on publish; keep draft completion behavior consistent with existing draft flows.

## 4. Wiki Workflow

- [x] 4.1 Extend or wrap `WikiPostEditor` so a create caller can provide `realmUnitIds` without making the editor realm-specific.
- [x] 4.2 Ensure wiki create sends `kind: WIKI`, `realmUnitIds: [realmId]`, language, content, and `status`.
- [x] 4.3 Add mutation/client coverage if `useCreateWikiPostMutation` currently omits realm-scoped variables from the type path.
- [x] 4.4 Keep collaborative wiki content translation and history behavior in the existing server post service path.

## 5. Poll Workflow

- [x] 5.1 Add a realm poll-post form that composes `PollComposer` with post body/tag/publication controls.
- [x] 5.2 Reuse the existing two-step behavior: create poll unit, then create realm `POST` with `extra.poll.unitId`.
- [x] 5.3 Surface post creation failure separately from poll creation failure, preserving the current non-atomic orphan-poll tolerance.
- [x] 5.4 Add or update tests around the input assembled after poll creation.

## 6. Existing Post Or Draft Workflow

- [ ] 6.1 Define the contract/API operation for author/member publishing an existing post to a realm, separate from realm admin content management.
- [ ] 6.2 Implement the server operation in the appropriate domain after deciding ownership: either post service owns "publish this post into realm" or realm service exposes a member-scoped submit route that delegates to post permission checks.
- [ ] 6.3 Reuse `assertRealmPostAllowed`-equivalent checks so membership state and rule acknowledgement behavior match new realm post creation.
- [ ] 6.4 Add frontend API mutation and cache invalidation for attaching an existing post/draft to a realm and refreshing realm post lists/drafts.
- [ ] 6.5 Add a page section that lists eligible drafts/posts by the current author, allows selection, optional realm tags, and submits/publishes into the realm.

## 7. Tests And Stories

- [ ] 7.1 Add app-level tests for `RealmCreatePage` mode selection and mutation payload assembly.
- [ ] 7.2 Add API/server tests for the new existing-post-to-realm route, including ordinary member allowed, banned/muted/pending member denied, missing rule acknowledgement denied, and realm admin content route remaining admin-scoped.
- [ ] 7.3 Add Storybook coverage for the page shell and major empty/loading/member/non-member states if nearby realm pages/components already have story coverage.
- [ ] 7.4 Run focused tests for changed app models/components and server domain tests; defer broad checks unless the implementation touches shared contracts broadly.

## Out of scope

- Replacing the global `/create` page.
- Changing reply/comment authoring.
- Reworking realm wiki zones or wiki tab management.
- Making `/r/$realmSlug/create` a first-class authoring route; a redirect can be added later.
- Building moderation queues for submitted existing content unless the existing-post API decision explicitly requires review states.
