---
title: Reaction Upvote/Downvote Cutover
status: done
created: 2026-06-05
completed: 2026-06-05
supersededBy:
tags: [reaction, engagement, ranking, notification, migration]
---

## Why

Rezics currently stores the binary voting surface as reaction kinds
`like`/`dislike`, while the product UI already presents that surface as
up/down voting: arrow icons, `tag_upvote`/`tag_downvote` labels, and a score
computed as positive minus negative reactions. The durable product concept
should be vote semantics, not like/dislike sentiment.

This is a development-stage clear cutover. The implementation should rename the
binary reaction values to `upvote`/`downvote` across contracts, runtime defaults,
data, app state, ranking, tests, and notifications. No compatibility layer for
old `like`/`dislike` reaction data is required.

## Durable constraints & decisions

- `(type)` The allowed binary reaction values are `upvote` and `downvote`.
  `like` and `dislike` must no longer be accepted by public or internal reaction
  create/delete contracts.
- `(type)` The reaction domain and package names remain `reaction`; only the
  binary reaction kind values change. This preserves the broader reaction model
  for future non-vote kinds such as `heart`, `funny`, and `award`.
- `(test)` Vote score is `upvote - downvote` everywhere the binary score is
  calculated or rendered.
- `(test)` Switching between the two vote states removes the old reaction and
  creates the new one with `upvote`/`downvote`, preserving the existing
  idempotent create/delete behavior.
- `(test)` Downvotes do not emit user notifications. Upvotes may emit a
  `reaction.upvote` notification to the target owner, excluding self-reactions.
- `(comment)` This cutover intentionally has no dual-read, dual-write, or
  response-mapping layer for `like`/`dislike`; development data is migrated in
  place and stale clients should fail contract validation.
- `(type)` `REACTION_TYPES` defaults and deployment examples must become
  `upvote,downvote`, matching the contract instead of relying on operator
  override.

## 1. Contract And Runtime Values

- [x] 1.1 Update `package/contract/src/reaction/reaction.schema.ts` so
  `allowedReactionKindSchema` accepts only `upvote`/`downvote`, and update
  `knownReactionKindSchema` to include those vote kinds instead of
  `like`/`dislike`.
- [x] 1.2 Update reaction contract tests in
  `package/contract/src/reaction/reaction.test.ts` to reject `like`/`dislike`
  and accept `upvote`/`downvote`.
- [x] 1.3 Update reaction runtime defaults in `package/reaction/src/env.ts`,
  `package/reaction/.env.example`, and `config/deploy.reaction.yml` from
  `like,dislike` to `upvote,downvote`.
- [x] 1.4 Review `package/contract/src/reaction/internal.ts` and
  `package/api/src/reaction/reaction.types.ts` callsites so their
  `AllowedReactionKind` usage follows the new value set without local string
  duplication.

## 2. Reaction Data And Service

- [x] 2.1 Add a reaction-service Drizzle migration under
  `package/reaction/drizzle/` that updates existing `Reaction.reaction` and
  `ReactionSummary.reaction` rows from `like`/`dislike` to
  `upvote`/`downvote`.
- [x] 2.2 Update `package/reaction/src/reaction/reaction.service.test.ts` so
  service create/remove/list/summary/quota coverage uses `upvote`/`downvote`.
- [x] 2.3 Run or update any reaction repository/service fixtures that encode
  `like`/`dislike`, keeping the database schema as varchar rather than adding a
  database enum.

## 3. Server Boundary And Notifications

- [x] 3.1 Update `package/server/src/reaction-boundary/reaction-boundary.api.ts`
  so only created `upvote` reactions emit a notification; `downvote` reactions
  return normally without notification broadcast.
- [x] 3.2 Rename the notification kind from `reaction.like` to
  `reaction.upvote` in `package/contract/src/notification/kind-registry.ts` and
  all server/notify/app tests and fixtures that consume it.
- [x] 3.3 Update i18n notification labels in `package/i18n/locales/*` from the
  old like key to an upvote key with locale-appropriate copy.
- [x] 3.4 Update `package/app/src/inbox/components/NotificationCard.tsx` and
  notification fixtures so inbox rendering recognizes `reaction.upvote`.
- [x] 3.5 Update `package/server/src/reaction-boundary/` and
  `package/server/src/notify-boundary/` tests to lock the upvote-only
  notification behavior and the renamed event kind.

## 4. App Engagement UI

- [x] 4.1 Update `package/app/src/engagement/hooks/voteAction.ts` and
  `useVoteController.ts` so `VoteValue` and create/delete/swap actions use
  `upvote`/`downvote`.
- [x] 4.2 Update `package/app/src/engagement/components/VoteGroup.tsx` so score,
  active state, and user reaction detection use `summary.upvote`,
  `summary.downvote`, and `userReactions.includes(...)`.
- [x] 4.3 Update engagement tests and stories in
  `package/app/src/engagement/hooks/useVoteController.test.ts`,
  `package/app/src/engagement/components/VoteGroup.stories.tsx`, and
  `package/app/src/engagement/components/ReactionBar.stories.tsx`.
- [x] 4.4 Update profile reaction history display in
  `package/app/src/user/components/ReactionHistoryItem.tsx` so upvote/downvote
  map to the existing thumbs icons.

## 5. Ranking, Seeds, And Activity Surfaces

- [x] 5.1 Update `package/ranking/src/ranking/formulas.ts` and ranking tests so
  score weighting reads `upvote` and `downvote` counts.
- [x] 5.2 Update factory and mock reaction seed values such as
  `package/server/src/db/factory/data.ts` from `like`/`dislike` to
  `upvote`/`downvote`.
- [x] 5.3 Update profile/activity comments, fixtures, and tests that display or
  filter reaction keys so examples use `upvote` instead of `like`.
- [x] 5.4 Search the repo for remaining exact `"like"`/`"dislike"` reaction
  values and update only reaction-owned usages; leave unrelated prose and
  non-reaction fields alone.

## 6. Verification

- [x] 6.1 Run targeted contract tests for reaction schemas and notification kind
  registry.
- [x] 6.2 Run targeted reaction service tests for create/remove/list/summary and
  migration-adjacent behavior.
- [x] 6.3 Run targeted app engagement tests for vote action decisions and
  rendered vote state.
- [x] 6.4 Run targeted server boundary tests for reaction create/delete and
  notification emission.
- [x] 6.5 Run targeted ranking tests for score formulas.
- [x] 6.6 Run `bun run check:convention` if the touched files include generated
  conventions, cross-package exports, or route-facing contracts.

## Out of scope

- Renaming the `reaction` service/package/API domain to `vote`.
- Supporting old `like`/`dislike` clients, query filters, or stored reaction
  values after the cutover.
- Designing a broader multi-reaction palette beyond preserving the existing
  future-facing `knownReactionKindSchema` shape.
- Changing the vote quota model or the one-active-upvote/downvote UI behavior
  beyond replacing the reaction kind values.
