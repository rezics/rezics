## 0. Preflight

- [ ] 0.1 Confirm `user-namespace-slug` (L3) has shipped and `User.unitId` exists in `package/server/prisma/schema.prisma`; otherwise abort and complete L3 first
- [ ] 0.2 Snapshot current row counts: `Follow`, `RealmMember`, `User.followersCount` / `followingsCount` totals — for migration verification later

## 1. Contract layer

- [ ] 1.1 Create `package/contract/src/subscription/channel-registry.ts` exporting `CHANNEL_REGISTRY` keyed by `UnitType` with `categories` and `events` per type for v1 (BOOK, USER, REALM, TAG, SHELF)
- [ ] 1.2 Export `isValidChannel(targetType, channel)` predicate and `assertValidChannels(targetType, channels[])` from the same module
- [ ] 1.3 Add Typebox schemas for `Subscription` DTO, `SubscriptionCreateBody`, `SubscriptionPatchBody`, `SubscriptionCheckResponse`, `SubscriberCountResponse`
- [ ] 1.4 Add Typebox event-shape for `{ kind, sourceUnitId, directRecipients?, payload? }` consumed by the fan-out resolver
- [ ] 1.5 Update `package/contract/src/index.ts` (and barrel exports) to expose the new subscription types; verify `tsc --noEmit` in `package/contract`

## 2. Database schema & migration

- [ ] 2.1 Add `Subscription` model to `package/server/prisma/schema.prisma` per design D1 (fields, `@@unique`, `@@index`)
- [ ] 2.2 Add `subscriberCount Int @default(0)` column on `Unit`
- [ ] 2.3 Generate Prisma migration; add a raw SQL step `CREATE INDEX subscription_channels_gin ON "Subscription" USING gin (channels);` inside the migration file
- [ ] 2.4 In the same migration, backfill: `INSERT INTO "Subscription" (id, subscriberUnitId, targetUnitId, channels, createdAt, updatedAt) SELECT ..., ARRAY['*'], ..., ... FROM "Follow"` and `ON CONFLICT DO NOTHING`
- [ ] 2.5 In the same migration, backfill `RealmMember → Subscription` for any `(realmUnitId, userId)` not yet present (with `channels=['*']`)
- [ ] 2.6 In the same migration, recompute `Unit.subscriberCount` and `User.followersCount` / `User.followingsCount` per design D8 and D6
- [ ] 2.7 In the same migration, drop the `Follow` table and its `User` relations
- [ ] 2.8 Remove `Follow` model and its `User.followers` / `User.followings` relations from the Prisma schema
- [ ] 2.9 Run `bun run prisma:generate` and verify client compiles

## 3. Subscription backend domain

- [ ] 3.1 Create `package/server/src/subscription/` directory with `subscription.api.ts`, `subscription.service.ts`, `subscription.mapper.ts`, `subscription.types.ts` following the domain pattern
- [ ] 3.2 Implement `subscribe(subscriberUnitId, targetUnitId, channels?)` — validates target visibility (private-realm gate), validates channels against registry, inserts row, increments `Unit.subscriberCount` and (if both ends are USER) `User.followers/followingsCount`, all in one tx
- [ ] 3.3 Implement `unsubscribe(subscriberUnitId, targetUnitId)` — inverse of 3.2
- [ ] 3.4 Implement `updateChannels(subscriberUnitId, targetUnitId, channels)` — validates and updates row only
- [ ] 3.5 Implement `listMine(userId, { targetType? })` and `checkSubscription(userId, targetUnitId)`
- [ ] 3.6 Implement `getSubscriberCount(targetUnitId)` — reads cached `Unit.subscriberCount`
- [ ] 3.7 Wire Elysia routes in `subscription.api.ts` per spec § "Subscription API endpoints"; mount via `.use()` in `package/server/src/index.ts`
- [ ] 3.8 Add error mapping for self-subscription, duplicate, unknown-channel-for-type cases following `backend-prisma-error-mapping`

## 4. Fan-out resolver & notification rewiring

- [ ] 4.1 Implement `resolveRecipients(event)` in `package/server/src/notification/` (or a shared subscription helper) per design D4, returning the union of `directRecipients` and the GIN-indexed subscription query result
- [ ] 4.2 Identify every existing call site that creates `Notification` rows; migrate each producer to emit `{ kind, sourceUnitId, directRecipients?, payload? }` and route through `resolveRecipients`
- [ ] 4.3 Delete the legacy per-domain hardcoded recipient resolution paths
- [ ] 4.4 Ensure deduplication (a single recipient never gets two rows for the same event) — covered by `INSERT ... ON CONFLICT` or in-memory set before insert
- [ ] 4.5 Verify SSE push (`notification-stream`) is unaffected — events are still pushed per row

## 5. Realm dual-track wiring

- [ ] 5.1 Refactor `joinRealm` in the realm service to write both `RealmMember` and `Subscription` rows in one Prisma `$transaction`, updating both counters
- [ ] 5.2 Refactor `leaveRealm` to remove both rows in one transaction; handle idempotent partial state per spec
- [ ] 5.3 Implement `muteRealm` / `unmuteRealm` service methods and Elysia routes `POST /realm/:id/mute` and `POST /realm/:id/unmute`
- [ ] 5.4 Update `subscribe` service to gate non-member subscription on `Realm.isPublic = true`

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
- [ ] 10.2 Update `openspec/plans/shelf-and-user-namespace-slug-plan.md` §6.1 to point to this change as the resolution of "Subscription Domain Unification"
- [ ] 10.3 Run `openspec validate engagement-subscription --strict` and resolve any reported issues
