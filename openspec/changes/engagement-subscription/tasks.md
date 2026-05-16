## 0. Preflight

- [x] 0.1 Confirm `user-namespace-slug` (L3) has shipped and `User.unitId` exists in `package/server/prisma/schema.prisma`; otherwise abort and complete L3 first
- [x] 0.2 Confirm `notify-broadcast-boundary` has shipped: `notifyBoundary.broadcast(event)` exists in `package/server/src/notify-boundary/notify-boundary.client.ts`; `KIND_REGISTRY` exists in `@rezics/contract`; notify accepts cookie auth; cookie scope is `Domain=.rezics.com` in prod; otherwise abort and complete that change first
- [x] 0.3 Snapshot current row counts: `Follow`, `RealmMember`, `User.followersCount` / `followingsCount` totals — for migration verification later (script: `openspec/changes/engagement-subscription/snapshot.sql`; **must be run by operator against live DB before applying §2 migration**)

## 1. Contract layer

- [x] 1.1 Create `package/contract/src/subscription/channel-registry.ts` exporting `CHANNEL_REGISTRY` keyed by `UnitType` with `categories` and `events` per type for v1 (BOOK, USER, REALM, TAG, SHELF). USER MUST include `categories: ['post', 'review', 'dm']` and `events: ['post.new', 'review.new', 'dm.message']` for the DM permission gate
- [x] 1.2 Export `isValidChannel(targetType, channel)` predicate and `assertValidChannels(targetType, channels[])` from the same module
- [x] 1.3 Add Typebox schemas for `Subscription` DTO, `SubscriptionCreateBody`, `SubscriptionPatchBody`, `SubscriptionCheckResponse`, `SubscriberCountResponse`
- [x] 1.4 Extend `KIND_REGISTRY` (lives in `package/contract/src/notification/kind-registry.ts`, owned by `notify-broadcast-boundary`) with new entries: `chapter.new`, `chapter.updated`, `chapter.deleted`, `review.new`, `review.updated`, `edition.new`, `metadata.changed`, `cover.changed`, `post.new`, `post.review`, `announcement.new`, `member.joined`, `unit.tagged`, `item.added`, `item.removed`. Aggregatability per kind decided per design D4
- [x] 1.5 Update `package/contract/src/index.ts` (and barrel exports) to expose the new subscription types; verify `tsc --noEmit` in `package/contract`

## 2. Database schema & migration

- [x] 2.1 Add `Subscription` model to `package/server/prisma/schema.prisma` per design D1 (fields, `@@unique`, `@@index`)
- [x] 2.2 Add `subscriberCount Int @default(0)` column on `Unit`
- [x] 2.3 Generate Prisma migration; add a raw SQL step `CREATE INDEX subscription_channels_gin ON "Subscription" USING gin (channels);` inside the migration file
- [x] 2.4 In the same migration, backfill: `INSERT INTO "Subscription" (id, subscriberUnitId, targetUnitId, channels, createdAt, updatedAt) SELECT ..., ARRAY['*'], ..., ... FROM "Follow"` and `ON CONFLICT DO NOTHING`
- [x] 2.5 In the same migration, backfill `RealmMember → Subscription` for any `(realmUnitId, userId)` not yet present (with `channels=['*']`)
- [x] 2.6 In the same migration, recompute `Unit.subscriberCount` and `User.followersCount` / `User.followingsCount` per design D8 and D6
- [x] 2.7 In the same migration, drop the `Follow` table and its `User` relations
- [x] 2.8 Remove `Follow` model and its `User.followers` / `User.followings` relations from the Prisma schema
- [x] 2.9 Run `bun run prisma:generate` and verify client compiles

## 3. Subscription backend domain

- [ ] 3.1 Create `package/server/src/subscription/` directory with `subscription.api.ts`, `subscription.service.ts`, `subscription.mapper.ts`, `subscription.types.ts` following the domain pattern
- [ ] 3.2 Implement `subscribe(subscriberUnitId, targetUnitId, channels?)` — validates target visibility (private-realm gate), validates channels against registry, inserts row, increments `Unit.subscriberCount` and (if both ends are USER) `User.followers/followingsCount`, all in one tx
- [ ] 3.3 Implement `unsubscribe(subscriberUnitId, targetUnitId)` — inverse of 3.2
- [ ] 3.4 Implement `updateChannels(subscriberUnitId, targetUnitId, channels)` — validates and updates row only
- [ ] 3.5 Implement `listMine(userId, { targetType? })` and `checkSubscription(userId, targetUnitId)`
- [ ] 3.6 Implement `getSubscriberCount(targetUnitId)` — reads cached `Unit.subscriberCount`
- [ ] 3.7 Wire Elysia routes in `subscription.api.ts` per spec § "Subscription API endpoints"; mount via `.use()` in `package/server/src/index.ts`
- [ ] 3.8 Add error mapping for self-subscription, duplicate, unknown-channel-for-type cases following `backend-prisma-error-mapping`

## 4. Fan-out resolver extension

- [ ] 4.1 Replace the `resolveRecipients` body in `package/server/src/notify-boundary/notify-boundary.client.ts` (signature already established by `notify-broadcast-boundary`) per design D4: union `directRecipients` with the GIN-indexed Subscription query result
- [ ] 4.2 Add a `categoryOf(kind)` helper that splits on first `.` and returns the prefix (used in the three-tier wildcard match)
- [ ] 4.3 Existing emit call sites already migrated to `notifyBoundary.broadcast` by `notify-broadcast-boundary`; add new domain emit sites for the new kinds (`chapter.new` from chapter creation, `member.joined` from realm join, etc.) as those domains land
- [ ] 4.4 Ensure deduplication via the in-memory `Set` already used in the v1 helper (the new query result is unioned into the same Set)
- [ ] 4.5 Add unit tests for `resolveRecipients` covering all three wildcard tiers, direct-recipient union, and the dedup case
- [ ] 4.6 Verify SSE push (`notification-stream`) is unaffected — events are still pushed per row by notify based on the resolved `recipientIds`

## 5. Realm dual-track wiring

- [ ] 5.1 Refactor `joinRealm` in the realm service to write both `RealmMember` and `Subscription` rows in one Prisma `$transaction`, updating both counters
- [ ] 5.2 Refactor `leaveRealm` to remove both rows in one transaction; handle idempotent partial state per spec
- [ ] 5.3 Implement `muteRealm` / `unmuteRealm` service methods and Elysia routes `POST /realm/:id/mute` and `POST /realm/:id/unmute`
- [ ] 5.4 Update `subscribe` service to gate non-member subscription on `Realm.isPublic = true`

## 5b. DM permission gate migration

- [ ] 5b.1 Update `package/server/src/notify-boundary/dm-boundary.api.ts`: replace the `prisma.follow.findUnique` check with a `prisma.subscription.findUnique` lookup on `(senderUnitId → recipientUnitId)`, accepting if `channels` includes `'*'`, `'dm.*'`, or `'dm.message'`
- [ ] 5b.2 Update the 403 error message to reference subscription ("You must subscribe to the recipient with DM enabled to send a direct message")
- [ ] 5b.3 Ensure the migration step in section 2 (Follow → Subscription backfill) creates entries with `channels=['*']` so existing follow-based DM permissions continue to work post-cutover
- [ ] 5b.4 Add backend tests for: subscribed sender with `['*']` channels can send, subscribed sender with `['post.new']` only is blocked, unsubscribed sender is blocked, mutual-subscription not required (one-way is sufficient per design D7a)
- [ ] 5b.5 Update `package/contract` DM types if any reference `Follow`-derived shapes (likely none — the DM contract is permission-result-shaped, not Follow-shaped)

## 6. Follow retirement

- [ ] 6.1 Remove `package/server/src/follow/` (entire domain) — service, api, mapper, types
- [ ] 6.2 Unmount `/follow/*` routes from `package/server/src/index.ts`
- [ ] 6.3 grep the monorepo for `Follow`, `follower`, `following` references; migrate each to subscription semantics or delete
- [ ] 6.4 Remove `Follow` Typebox schemas from `package/contract` and clean up barrel exports

## 7. Frontend API hooks

- [ ] 7.1 Add `package/api/src/subscription/` with hooks: `useSubscribe`, `useUnsubscribe`, `useUpdateSubscriptionChannels`, `useIsSubscribed`, `useSubscriberCount`, `useMySubscriptions`
- [ ] 7.2 Add query options modules consistent with the rest of `@rezics/api`
- [ ] 7.3 Remove `useFollow` / `useUnfollow` / `useFollowers` / `useFollowings` hooks and any related query keys
- [ ] 7.4 Update `useMyRealmMembership` consumers if they read derived "is subscribed" state; replace with `useIsSubscribed`
- [ ] 7.5 Verify `tsc --noEmit` in `package/api`

## 8. Frontend UI integration

- [ ] 8.1 Update `profile-followers-tab` sections in `package/app` to read followers/followings via the subscription hooks; remove `Follow`-table reads
- [ ] 8.2 Update follow/unfollow buttons on user cards/profile pages to call `useSubscribe` / `useUnsubscribe` with default `channels=['*']`
- [ ] 8.3 Add a minimal `mute realm` affordance on the realm header (calls `useUnsubscribe` while preserving membership); unmute on same surface
- [ ] 8.4 (Polish, can defer within this change) Realm header notification preference panel exposing channel-picker (multi-select against `CHANNEL_REGISTRY.REALM`)
- [ ] 8.5 Verify dev server starts and golden-path UI flows: follow a user, unfollow, join a realm, mute a realm, unmute, leave a realm; check that counts update without manual refresh

## 8b. DM inbox UI

- [ ] 8b.1 Create `package/api/src/dm/` with hooks: `useConversations`, `useMessages(conversationId)` (paginated), `useSendDm` (mutation against server's `POST /dm/send`), `useDmStream` (WS client opening notify's `WS /dm` cookie-authenticated per `notify-broadcast-boundary`)
- [ ] 8b.2 Add query-options modules consistent with the rest of `@rezics/api`
- [ ] 8b.3 Add routes in `package/app/src/routes/_mainLayout/inbox/dm/`: `index.tsx` for conversation list, `$conversationId.tsx` for thread view
- [ ] 8b.4 Implement `ConversationListSection` in `package/app/src/inbox/sections/`: lists conversations sorted by `updatedAt` desc; clicking a conversation routes to thread view
- [ ] 8b.5 Implement `ConversationThreadSection`: paginated message list (newest at bottom), send box at the bottom, optimistic message append on send, real-time append on `useDmStream` events
- [ ] 8b.6 Mount `useDmStream()` in `MainNavigation.tsx` (or wherever `useNotificationStream` was mounted by `notify-broadcast-boundary`); on incoming message invalidate the conversation list and the active thread query
- [ ] 8b.7 Add inbox tab affordance to switch between Notifications and DM (the existing `NotificationTabSection` from `notify-broadcast-boundary` becomes one tab; DM list becomes another)
- [ ] 8b.8 Update locale files (`package/app/src/locale/*.ts`) with DM-related copy
- [ ] 8b.9 Verify dev server flow: log in as user A, subscribe to user B (default `['*']`), send DM from A's profile, log in as B, see DM in inbox, reply, see reply on A's side live via WS

## 9. Validation

- [ ] 9.1 Backend unit tests for `subscription.service` covering: subscribe / unsubscribe / patch channels / check / count / self-subscribe rejection / duplicate rejection / channel-validation failures
- [ ] 9.2 Backend unit tests for `resolveRecipients` covering all three wildcard tiers and direct-recipient union
- [ ] 9.3 Backend unit tests for realm `join` / `leave` / `mute` / `unmute` transaction atomicity
- [ ] 9.4 Migration verification script comparing pre-migration `Follow` count to post-migration `Subscription` count, and pre/post `followersCount` / `followingsCount`
- [ ] 9.5 `bun run check:convention` passes
- [ ] 9.6 `tsc --noEmit` passes in `package/contract`, `package/server`, `package/api`, `package/app`
- [ ] 9.7 Manual UI smoke test on the golden flows from 8.5

## 10. Cleanup

- [ ] 10.1 Remove `User.followersCount` / `User.followingsCount` from the `User` extension only if a follow-up decision retires denormalized counters (default: keep them, write them through subscription service)
- [ ] 10.2 Run `openspec validate engagement-subscription --strict` and resolve any reported issues
