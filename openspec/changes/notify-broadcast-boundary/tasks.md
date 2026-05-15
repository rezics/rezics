## 0. Preflight

- [ ] 0.1 Confirm notify DB is dev-only (`package/notify/.env` points to a dev database; no production data exists yet)
- [ ] 0.2 Snapshot the four current `emitNotificationEvent` call sites for migration reference: `package/server/src/reaction-boundary/reaction-boundary.api.ts`, `package/server/src/user/service/user.service.ts`, `package/server/src/unit/work-link.service.ts`, `package/server/src/unit/work-link-claim.service.ts`

## 1. Trust-boundary capability spec

- [ ] 1.1 Add `subdomain-trust-boundary` to `openspec/specs/` after change is archived (the change file `specs/subdomain-trust-boundary/spec.md` is the source of the new capability)
- [ ] 1.2 Reference the new capability from `CLAUDE.md` if/when it deserves a "Security" section, or from `CONTRIBUTING.md` security notes (defer if neither doc has a security section yet)

## 2. Cookie scope migration (server)

- [ ] 2.1 Update `package/server/src/auth-boundary/auth-boundary.service.ts` `buildMainCookie`: in production, append `Domain=.rezics.com` to the cookie attributes; leave dev as-is (host-only on localhost)
- [ ] 2.2 Update logout flow to issue cookie clear with the same `Domain=.rezics.com` attribute in production
- [ ] 2.3 Update `package/server/src/auth-boundary/auth-public.api.test.ts` to assert `Set-Cookie` includes `Domain=.rezics.com` in production-mode tests and excludes it in dev-mode tests
- [ ] 2.4 Add a unit test that asserts the logout `Set-Cookie` header carries `Max-Age=0` AND the same `Domain` attribute that session creation used (logout symmetry per trust-boundary invariant 3)

## 3. CORS configuration (notify)

- [ ] 3.1 Update `package/notify/src/index.ts` cors() config: set `credentials: true`
- [ ] 3.2 Replace the hardcoded prod origin list with a function-form check that allows `https://rezics.com` and any `https://*.rezics.com` origin
- [ ] 3.3 Verify dev origins still include `http://localhost:35001`, `http://localhost:35002`, `http://localhost:8000`
- [ ] 3.4 Manual smoke: from a `book.rezics.com`-style origin (use a `/etc/hosts` alias or `localtest.me` if needed in dev), open notify's `/openapi` page and confirm CORS preflight succeeds

## 4. Notify auth: cookie support

- [ ] 4.1 Add a `readCookie` helper to `package/notify/src/macro/auth.ts` (mirror server's `permission.ts` implementation)
- [ ] 4.2 Add `resolveSessionToken(authorization, cookieHeader)` that returns `Authorization` value (with `Bearer ` stripped) OR cookie value of `rezics-session-token`
- [ ] 4.3 Update `requireUser` macro to call `resolveSessionToken` instead of reading `Authorization` only; handle the case where the `Authorization` header is absent and only a cookie is present
- [ ] 4.4 Update `package/notify/src/macro/auth.ts`'s `verifyJwtToken` export if it is still used directly by any caller; otherwise leave as-is
- [ ] 4.5 Add tests in `package/notify/src/macro/auth.test.ts` covering: Authorization-only auth, cookie-only auth, both present (Authorization wins), neither present (401)

## 5. Notify DB schema migration

- [ ] 5.1 Update `package/notify/prisma/schema.prisma`: drop `NotificationType` enum; replace `type`, `entityType`, `entityId` with `kind String @db.VarChar(64)` and `sourceUnitId String @db.Uuid`; rename `meta` to `extra`; recreate indexes per design D5
- [ ] 5.2 In dev, run `bun -F @rezics/notify prisma:migrate reset` followed by `bun -F @rezics/notify prisma:migrate dev --name broadcast_event_shape` to regenerate from scratch with the new schema
- [ ] 5.3 Run `bun -F @rezics/notify prisma:generate` and verify the client compiles
- [ ] 5.4 Update `package/notify/prisma/migrations/migration_lock.toml` if needed

## 6. Contract package: kind registry & schemas

- [ ] 6.1 Create `package/contract/src/notification/kind-registry.ts` exporting `KIND_REGISTRY` flat map, `NotificationKind` type, `isValidKind(kind)` predicate, `isAggregatable(kind)` predicate
- [ ] 6.2 Populate `KIND_REGISTRY` v1 entries: `reaction.like`, `reaction.favorite`, `follow.new`, `comment.new`, `mention.new`, `system.notice`, `invitation.new`. Add work-link kinds based on the existing work-link emit call sites
- [ ] 6.3 Update `package/contract/src/notify/internal.ts`: rename `internalEventBodySchema` to `internalBroadcastBodySchema` with the new shape `{ kind, sourceUnitId, recipientIds, actorId?, extra? }`. Remove the old single-recipient schema
- [ ] 6.4 Update `package/contract/src/notify/notification.ts`: replace `NotificationType` references with `kind: string`; update `markReadBodySchema` to `{ kind, sourceUnitId }`; remove `AGGREGATABLE_TYPES` constant and any `NotificationType` enum re-exports
- [ ] 6.5 Update `package/contract/src/notify/index.ts` barrel to export new symbols and stop exporting removed ones
- [ ] 6.6 Run `bun -F @rezics/contract tsc --noEmit` and confirm the package builds

## 7. Notify internal API: broadcast endpoint

- [ ] 7.1 Rewrite `POST /internal/event` handler in `package/notify/src/internal/internal.api.ts` to accept `internalBroadcastBodySchema`
- [ ] 7.2 Validate `kind` against `KIND_REGISTRY` (defense in depth — server already validates); return 400 for unknown kind
- [ ] 7.3 Construct row data array `recipientIds.map(rid => ({ recipientId: rid, actorId, kind, sourceUnitId, extra }))`; use `prisma.notification.createMany({ data: rows })`
- [ ] 7.4 Iterate `recipientIds` and call SSE `publish(rid, mapNotificationToRawEvent(...))` for each; map the raw event from the row data (createMany does not return rows, so synthesize the SSE payload from input + a per-row UUID — or use `createManyAndReturn` if Prisma supports it on this version)
- [ ] 7.5 Return `{ success: true, persisted: rows.length }`
- [ ] 7.6 Add tests for: single-recipient broadcast (mention-style), multi-recipient broadcast (broadcast-style), empty recipients (no-op success), unknown kind (400)

## 8. Notify notification API: aggregation key shift

- [ ] 8.1 Update `getNotifications` in `package/notify/src/notification/notification.service.ts`: change the raw SQL grouping from `(type, entityType, entityId)` to `(kind, sourceUnitId)`; column references update accordingly
- [ ] 8.2 Update `getUnreadCount` similarly
- [ ] 8.3 Update `markAsRead` to accept `(kind, sourceUnitId)` body
- [ ] 8.4 Determine aggregatable vs individual kinds by `KIND_REGISTRY[kind].aggregatable` instead of the removed `AGGREGATABLE_TYPES` constant
- [ ] 8.5 Rewrite `package/notify/src/notification/notification.mapper.ts` for the new row shape; ensure `mapToAggregatedItems` returns items keyed by `(kind, sourceUnitId)` with `actorIds[]`, `count`, `latestAt`, `extra`
- [ ] 8.6 Update `package/notify/src/notification/notification.api.ts` to consume the new body schema for `markReadBodySchema` and pass `(kind, sourceUnitId)` through

## 9. Notify DM WS: cookie auth

- [ ] 9.1 Update `package/notify/src/dm/dm.api.ts` WS open handler to read `headers.cookie` from the upgrade request, extract `rezics-session-token`, and verify via `verifyJwtToken`
- [ ] 9.2 Remove the `?token=` query parameter extraction path
- [ ] 9.3 On verification failure, close with code 4001 (unchanged)
- [ ] 9.4 Update the `direct-messaging` spec scenario in this change to reflect the new auth path

## 10. Server: notifyBoundary.broadcast helper

- [ ] 10.1 Add `broadcast(event)` to `package/server/src/notify-boundary/notify-boundary.client.ts` per design D3; v1 `resolveRecipients` body returns `Array.from(new Set(event.directRecipients ?? []))`
- [ ] 10.2 Validate `kind` against `KIND_REGISTRY` before sending; throw or log + drop unknown kinds (decide based on existing fire-and-forget patterns — likely log + drop to preserve current ergonomics)
- [ ] 10.3 Remove `emitNotificationEvent` export
- [ ] 10.4 Add unit tests for `broadcast`: directRecipients deduplicated, empty recipients short-circuits to no HTTP call, unknown kind handled per chosen policy
- [ ] 10.5 Document in a JSDoc comment that `resolveRecipients` will be extended by `engagement-subscription` to union with Subscription query results — this is the contract surface

## 11. Server: migrate the four existing emit call sites

- [ ] 11.1 `package/server/src/reaction-boundary/reaction-boundary.api.ts`: replace `emitNotificationEvent({ recipientId: unit.userId, type: NotificationType.LIKE, ... })` with `broadcast({ kind: 'reaction.like', sourceUnitId: body.targetId, directRecipients: [unit.userId], actorId: userId, extra: {} })`. Also handle the favorite path if present in the same file
- [ ] 11.2 `package/server/src/user/service/user.service.ts` follow path: replace with `broadcast({ kind: 'follow.new', sourceUnitId: <followingUserUnitId>, directRecipients: [followingId], actorId: followerId })`. Resolve `followingUserUnitId` from existing user data; pre-L3 this is the same value as the user PK
- [ ] 11.3 `package/server/src/unit/work-link.service.ts`: identify the existing emit call(s); add corresponding `KIND_REGISTRY` entries (e.g., `work-link.created`, `work-link.updated`); migrate
- [ ] 11.4 `package/server/src/unit/work-link-claim.service.ts`: same pattern for the claim flow
- [ ] 11.5 Verify the server builds: `bun -F @rezics/server tsc --noEmit`
- [ ] 11.6 Run server tests touching reaction, follow, and work-link paths

## 12. Frontend API hooks

- [ ] 12.1 Create `package/api/src/notification/` directory
- [ ] 12.2 Implement `useNotifications` (paginated list query against `GET /notification/list`)
- [ ] 12.3 Implement `useUnreadCount` (against `GET /notification/unread-count`)
- [ ] 12.4 Implement `useMarkAsRead` (mutation against `POST /notification/read` with `{ kind, sourceUnitId }`); on success, invalidate list + unread-count queries
- [ ] 12.5 Implement `useMarkAllAsRead` (mutation against `POST /notification/read-all`); on success, invalidate same queries
- [ ] 12.6 Implement `useDeleteNotification` (mutation against `DELETE /notification/:id`); on success, optimistically remove from list cache
- [ ] 12.7 Add query-options modules consistent with the rest of `@rezics/api` (`notificationQueryOptions`, etc.)
- [ ] 12.8 Update `package/api/src/index.ts` (or appropriate barrel) to export the new hooks
- [ ] 12.9 Verify `bun -F @rezics/api tsc --noEmit`

## 13. Frontend SSE client

- [ ] 13.1 Implement `useNotificationStream` in `package/api/src/notification/use-notification-stream.ts` using `new EventSource(url, { withCredentials: true })`
- [ ] 13.2 On message: parse JSON; invalidate `['notifications']` and `['notifications', 'unread-count']` queries (or optimistically prepend to the list cache for snappier UX)
- [ ] 13.3 On error: rely on `EventSource` auto-reconnect; ensure cleanup on hook unmount (`es.close()`)
- [ ] 13.4 Configure `NOTIFY_BASE_URL` resolution from app env (mirror existing `package/api` env pattern)

## 14. Frontend UI integration

- [ ] 14.1 Replace `package/app/src/inbox/pages/NotificationPage.tsx` body with a real list view rendering `useNotifications().data?.items`; show `NotificationCard` per item; mark-as-read on click; empty / loading / error states
- [ ] 14.2 Replace `package/app/src/inbox/sections/NotificationTabSection.tsx` body similarly (this is the tab variant, likely the in-header drawer)
- [ ] 14.3 Update `NotificationCard.tsx` to consume the new `kind`/`sourceUnitId`/`extra` shape; aggregation rendering uses `actorIds[]` + `count`
- [ ] 14.4 Add unread-count badge on the header bell — locate the bell icon in `package/app/src/core/components/navigation/MainNavigation.tsx` (or `AuthenticatedSection.tsx`); render badge driven by `useUnreadCount().data?.count`
- [ ] 14.5 Mount `useNotificationStream()` in `MainNavigation.tsx` (or whichever component is the most natural single mount point post-login)
- [ ] 14.6 Update locale files (`package/app/src/locale/*.ts`) for any new copy ("No notifications yet", "Mark all as read", etc.)
- [ ] 14.7 Verify dev server starts and golden-path UI flow: log in, react to a unit owned by another user, see the notification appear in the list, see the badge increment, mark as read, see the badge decrement

## 15. Validation

- [ ] 15.1 `bun -F @rezics/contract tsc --noEmit`
- [ ] 15.2 `bun -F @rezics/notify tsc --noEmit`
- [ ] 15.3 `bun -F @rezics/server tsc --noEmit`
- [ ] 15.4 `bun -F @rezics/api tsc --noEmit`
- [ ] 15.5 `bun -F @rezics/app tsc --noEmit`
- [ ] 15.6 `bun -F @rezics/notify test`
- [ ] 15.7 `bun -F @rezics/server test` (focus on reaction-boundary, user follow, work-link emit paths)
- [ ] 15.8 `bun run check:convention` passes
- [ ] 15.9 Run `openspec validate notify-broadcast-boundary --strict` and resolve any reported issues
- [ ] 15.10 Manual UI smoke per task 14.7
- [ ] 15.11 Document in the change PR description: "notify DB destructive migration; run `bun -F @rezics/notify prisma:migrate reset` in dev environments"

## 16. Cleanup

- [ ] 16.1 Grep the monorepo for `NotificationType`, `emitNotificationEvent`, `AGGREGATABLE_TYPES`, `entityType`, `entityId` (in notification context) and confirm zero remaining references
- [ ] 16.2 Grep for `?token=` in WS contexts and confirm removal
- [ ] 16.3 Update any out-of-date storybook fixtures in `package/app/src/stories/fixtures/notification.ts` to the new shape
- [ ] 16.4 Confirm `engagement-subscription` proposal/design/tasks have been updated to depend on this change (the next step in this work session)
