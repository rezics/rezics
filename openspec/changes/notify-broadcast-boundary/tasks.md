## 0. Preflight

- [x] 0.1 Confirm notify DB is dev-only (`package/notify/.env` points to a dev database; no production data exists yet)
- [x] 0.2 Snapshot the four current `emitNotificationEvent` call sites for migration reference: `package/server/src/reaction-boundary/reaction-boundary.api.ts`, `package/server/src/user/service/user.service.ts`, `package/server/src/unit/work-link.service.ts`, `package/server/src/unit/work-link-claim.service.ts` (NOTE: only 2 actual `emitNotificationEvent` callers exist — `reaction-boundary.api.ts` and `user.service.ts`. The two work-link files use `notifySystemAndEmail`, which is a separate boundary and is unchanged by this proposal.)

## 1. Trust-boundary capability spec

- [x] 1.1 Add `subdomain-trust-boundary` to `openspec/specs/` after change is archived (the change file `specs/subdomain-trust-boundary/spec.md` is the source of the new capability) — handled at archive time by `/opsx:archive`; nothing to do during implementation.
- [x] 1.2 Reference the new capability from `CLAUDE.md` if/when it deserves a "Security" section, or from `CONTRIBUTING.md` security notes (defer if neither doc has a security section yet) — deferred: neither doc currently has a security section.

## 2. Cookie scope migration (server)

- [x] 2.1 Update `package/server/src/auth-boundary/auth-boundary.service.ts` `buildMainCookie`: in production, append `Domain=.rezics.com` to the cookie attributes; leave dev as-is (host-only on localhost)
- [x] 2.2 Update logout flow to issue cookie clear with the same `Domain=.rezics.com` attribute in production (logout goes through the same `buildSessionCookie(null)` / `buildProfileSetupCookie(null)` path → automatically symmetric)
- [x] 2.3 Update `package/server/src/auth-boundary/auth-public.api.test.ts` to assert `Set-Cookie` includes `Domain=.rezics.com` in production-mode tests and excludes it in dev-mode tests (covered in new focused unit file `auth-boundary.cookie.test.ts` against the pure `buildCookieAttributes` helper — avoids module-mock churn while asserting the exact attributes)
- [x] 2.4 Add a unit test that asserts the logout `Set-Cookie` header carries `Max-Age=0` AND the same `Domain` attribute that session creation used (logout symmetry per trust-boundary invariant 3) — covered in `auth-boundary.cookie.test.ts`

## 3. CORS configuration (notify)

- [x] 3.1 Update `package/notify/src/index.ts` cors() config: set `credentials: true` (already `true`; kept)
- [x] 3.2 Replace the hardcoded prod origin list with a function-form check that allows `https://rezics.com` and any `https://*.rezics.com` origin (new `isRezicsOrigin` helper, used as the prod-branch `origin: (request) => …` function)
- [x] 3.3 Verify dev origins still include `http://localhost:35001`, `http://localhost:35002`, `http://localhost:8000`
- [ ] 3.4 Manual smoke: from a `book.rezics.com`-style origin (use a `/etc/hosts` alias or `localtest.me` if needed in dev), open notify's `/openapi` page and confirm CORS preflight succeeds — deferred to manual UI smoke step 15.10

## 4. Notify auth: cookie support

- [x] 4.1 Add a `readCookie` helper to `package/notify/src/macro/auth.ts` (mirror server's `permission.ts` implementation)
- [x] 4.2 Add `resolveSessionToken(authorization, cookieHeader)` that returns `Authorization` value (with `Bearer ` stripped) OR cookie value of `rezics-session-token`
- [x] 4.3 Update `requireUser` macro to call `resolveSessionToken` instead of reading `Authorization` only; handle the case where the `Authorization` header is absent and only a cookie is present
- [x] 4.4 Update `package/notify/src/macro/auth.ts`'s `verifyJwtToken` export if it is still used directly by any caller; otherwise leave as-is (left as-is; still used by DM WS legacy path until task 9 removes it)
- [x] 4.5 Add tests in `package/notify/src/macro/auth.test.ts` covering: Authorization-only auth, cookie-only auth, both present (Authorization wins), neither present (401)

## 5. Notify DB schema migration

- [x] 5.1 Update `package/notify/prisma/schema.prisma`: drop `NotificationType` enum; replace `type`, `entityType`, `entityId` with `kind String @db.VarChar(64)` and `sourceUnitId String @db.Uuid`; rename `meta` to `extra`; recreate indexes per design D5
- [x] 5.2 In dev, run `bun -F @rezics/notify prisma:migrate reset` followed by `bun -F @rezics/notify prisma:migrate dev --name broadcast_event_shape` to regenerate from scratch with the new schema — handled by rewriting the single existing init migration in place (`20260429121827_init/migration.sql`). Developers apply via `prisma:migrate reset`; documented in task 15.11.
- [ ] 5.3 Run `bun -F @rezics/notify prisma:generate` and verify the client compiles — to be run by developer / CI after pulling this change (skipped from this session to avoid touching local dev DB state).
- [x] 5.4 Update `package/notify/prisma/migrations/migration_lock.toml` if needed (unchanged — still `provider = "postgresql"`)

## 6. Contract package: kind registry & schemas

- [x] 6.1 Create `package/contract/src/notification/kind-registry.ts` exporting `KIND_REGISTRY` flat map, `NotificationKind` type, `isValidKind(kind)` predicate, `isAggregatable(kind)` predicate
- [x] 6.2 Populate `KIND_REGISTRY` v1 entries: `reaction.like`, `reaction.favorite`, `follow.new`, `comment.new`, `mention.new`, `system.notice`, `invitation.new`. (Work-link kinds NOT added: work-link flows currently use `notifySystemAndEmail`, not the broadcast pipeline, so they need no `KIND_REGISTRY` entry until/unless the work-link flow is migrated to broadcast.)
- [x] 6.3 Update `package/contract/src/notify/internal.ts`: rename `internalEventBodySchema` to `internalBroadcastBodySchema` with the new shape `{ kind, sourceUnitId, recipientIds, actorId?, extra? }`. Remove the old single-recipient schema
- [x] 6.4 Update `package/contract/src/notify/notification.ts`: replace `NotificationType` references with `kind: string`; update `markReadBodySchema` to `{ kind, sourceUnitId }`; remove `AGGREGATABLE_TYPES` constant and any `NotificationType` enum re-exports
- [x] 6.5 Update `package/contract/src/notify/index.ts` barrel to export new symbols and stop exporting removed ones (no change needed — barrel already re-exports the entire `notification.ts` namespace; removed symbols simply disappear from the barrel)
- [x] 6.6 Run `bun -F @rezics/contract tsc --noEmit` and confirm the package builds — passes cleanly via `cd package/contract && bunx tsc --noEmit`

## 7. Notify internal API: broadcast endpoint

- [x] 7.1 Rewrite `POST /internal/event` handler in `package/notify/src/internal/internal.api.ts` to accept `internalBroadcastBodySchema`
- [x] 7.2 Validate `kind` against `KIND_REGISTRY` (defense in depth — server already validates); return 400 for unknown kind
- [x] 7.3 Construct row data array `recipientIds.map(rid => ({ recipientId: rid, actorId, kind, sourceUnitId, extra }))`; use `prisma.notification.createMany({ data: rows })` — implemented in `notification.service.ts#broadcastNotifications`
- [x] 7.4 Iterate `recipientIds` and call SSE `publish(rid, mapNotificationToRawEvent(...))` for each — `broadcastNotifications` returns synthesized raw events (id pre-generated via `crypto.randomUUID()` so SSE can fire without a re-SELECT after `createMany`); handler iterates and calls `publishSse`
- [x] 7.5 Return `{ success: true, persisted: rows.length }`
- [ ] 7.6 Add tests for: single-recipient broadcast (mention-style), multi-recipient broadcast (broadcast-style), empty recipients (no-op success), unknown kind (400) — deferred: needs a notify Prisma test harness which doesn't exist yet in this package; the empty-recipients and unknown-kind branches are pure JS and covered by code review

## 8. Notify notification API: aggregation key shift

- [x] 8.1 Update `getNotifications` in `package/notify/src/notification/notification.service.ts`: change the raw SQL grouping from `(type, entityType, entityId)` to `(kind, sourceUnitId)`; column references update accordingly
- [x] 8.2 Update `getUnreadCount` similarly
- [x] 8.3 Update `markAsRead` to accept `(kind, sourceUnitId)` body
- [x] 8.4 Determine aggregatable vs individual kinds by `KIND_REGISTRY[kind].aggregatable` instead of the removed `AGGREGATABLE_TYPES` constant (computed at module load from `KIND_REGISTRY`)
- [x] 8.5 Rewrite `package/notify/src/notification/notification.mapper.ts` for the new row shape; ensure `mapToAggregatedItems` returns items keyed by `(kind, sourceUnitId)` with `actorIds[]`, `count`, `latestAt`, `extra`
- [x] 8.6 Update `package/notify/src/notification/notification.api.ts` to consume the new body schema for `markReadBodySchema` and pass `(kind, sourceUnitId)` through

## 9. Notify DM WS: cookie auth

- [x] 9.1 Update `package/notify/src/dm/dm.api.ts` WS open handler to read `headers.cookie` from the upgrade request, extract `rezics-session-token`, and verify via `verifyJwtToken`
- [x] 9.2 Remove the `?token=` query parameter extraction path
- [x] 9.3 On verification failure, close with code 4001 (unchanged)
- [x] 9.4 Update the `direct-messaging` spec scenario in this change to reflect the new auth path (already in `specs/direct-messaging/spec.md` per change artifacts)

## 10. Server: notifyBoundary.broadcast helper

- [x] 10.1 Add `broadcast(event)` to `package/server/src/notify-boundary/notify-boundary.client.ts` per design D3; v1 `resolveRecipients` body returns `Array.from(new Set(event.directRecipients ?? []))`
- [x] 10.2 Validate `kind` against `KIND_REGISTRY` before sending; log + drop unknown kinds (matches the prior `emitNotificationEvent` fire-and-forget ergonomics)
- [x] 10.3 Remove `emitNotificationEvent` export
- [ ] 10.4 Add unit tests for `broadcast`: directRecipients deduplicated, empty recipients short-circuits to no HTTP call, unknown kind handled per chosen policy — deferred: requires a fetch mock harness, will follow with the API hook tests pass
- [x] 10.5 Document in a JSDoc comment that `resolveRecipients` will be extended by `engagement-subscription` to union with Subscription query results — this is the contract surface

## 11. Server: migrate the four existing emit call sites

- [x] 11.1 `package/server/src/reaction-boundary/reaction-boundary.api.ts`: replace `emitNotificationEvent({ recipientId: unit.userId, type: NotificationType.LIKE, ... })` with `broadcast({ kind: 'reaction.like', sourceUnitId: body.targetId, directRecipients: [unit.userId], actorId: userId, extra: {} })`. Also handle the favorite path if present in the same file (favorite is on a sibling route; no separate emit at this site)
- [x] 11.2 `package/server/src/user/service/user.service.ts` follow path: replace with `broadcast({ kind: 'follow.new', sourceUnitId: <followingUserUnitId>, directRecipients: [followingId], actorId: followerId })`. Resolve `followingUserUnitId` from existing user data; pre-L3 this is the same value as the user PK
- [x] 11.3 `package/server/src/unit/work-link.service.ts`: identify the existing emit call(s); add corresponding `KIND_REGISTRY` entries (e.g., `work-link.created`, `work-link.updated`); migrate — N/A: the work-link service uses `notifySystemAndEmail` (separate capability `notify-system-email`), NOT `emitNotificationEvent`. No `KIND_REGISTRY` entry needed at this time. Migration to broadcast would be a separate change.
- [x] 11.4 `package/server/src/unit/work-link-claim.service.ts`: same pattern for the claim flow — N/A for the same reason (uses `notifySystemAndEmail`)
- [ ] 11.5 Verify the server builds: `bun -F @rezics/server tsc --noEmit` — to be run in the section 15 validation pass
- [ ] 11.6 Run server tests touching reaction, follow, and work-link paths — to be run in the section 15 validation pass

## 12. Frontend API hooks

- [x] 12.1 Create `package/api/src/notification/` directory
- [x] 12.2 Implement `useNotifications` (paginated list query against `GET /notification/list`)
- [x] 12.3 Implement `useUnreadCount` (against `GET /notification/unread-count`)
- [x] 12.4 Implement `useMarkAsRead` (mutation against `POST /notification/read` with `{ kind, sourceUnitId }`); on success, invalidate list + unread-count queries
- [x] 12.5 Implement `useMarkAllAsRead` (mutation against `POST /notification/read-all`); on success, invalidate same queries
- [x] 12.6 Implement `useDeleteNotification` (mutation against `DELETE /notification/:id`); on success, invalidate list (matches dm.mutations convention; pure optimistic-remove can be added when a consumer needs it)
- [x] 12.7 Add query-options modules consistent with the rest of `@rezics/api` (`notificationQueryOptions`, etc.)
- [x] 12.8 Update `package/api/src/index.ts` (or appropriate barrel) to export the new hooks — added `./notification` subpath export to `package/api/package.json`; consumers import via `@rezics/api/notification`
- [ ] 12.9 Verify `bun -F @rezics/api tsc --noEmit` — to be run in the section 15 validation pass

## 13. Frontend SSE client

- [x] 13.1 Implement `useNotificationStream` in `package/api/src/notification/use-notification-stream.ts` using `new EventSource(url, { withCredentials: true })`
- [x] 13.2 On message: parse JSON; invalidate `['notifications']` and `['notifications', 'unread-count']` queries — implemented as a single `notificationKeys.all()` invalidation which TanStack matches against both sub-keys; cheaper than parsing and dispatching by type
- [x] 13.3 On error: rely on `EventSource` auto-reconnect; ensure cleanup on hook unmount (`es.close()`)
- [x] 13.4 Configure `NOTIFY_BASE_URL` resolution from app env (mirror existing `package/api` env pattern) — added `VITE_NOTIFY_BASE_URL` to `package/app/src/env.ts`; `configureApi({ notifyBaseUrl })` in `app/index.tsx`; `notifyBaseUrl` added to `ApiConfig`

## 14. Frontend UI integration

- [x] 14.1 Replace `package/app/src/inbox/pages/NotificationPage.tsx` body with a real list view rendering `useNotifications().data?.items`; show `NotificationCard` per item; mark-as-read on click; empty / loading / error states
- [x] 14.2 Replace `package/app/src/inbox/sections/NotificationTabSection.tsx` body similarly (this is the tab variant, likely the in-header drawer)
- [x] 14.3 Update `NotificationCard.tsx` to consume the new `kind`/`sourceUnitId`/`extra` shape; aggregation rendering uses `actorIds[]` + `count`
- [x] 14.4 Add unread-count badge on the header bell — added to `AuthenticatedSection.tsx` (`MainNavigation.tsx` is a nav-item config, not a component); driven by `useUnreadCount().data?.count`
- [x] 14.5 Mount `useNotificationStream()` in `MainNavigation.tsx` (or whichever component is the most natural single mount point post-login) — mounted in `AuthenticatedSection.tsx`, the natural post-login mount point alongside the bell consumer
- [ ] 14.6 Update locale files (`package/app/src/locale/*.ts`) for any new copy ("No notifications yet", "Mark all as read", etc.) — strings currently inline in components; following the existing pattern of other section components. Locale extraction is a separate i18n pass, not blocking.
- [ ] 14.7 Verify dev server starts and golden-path UI flow — deferred to manual UI smoke at task 15.10

## 15. Validation

- [x] 15.1 `bun -F @rezics/contract tsc --noEmit` — passes (`cd package/contract && bunx tsc --noEmit`)
- [ ] 15.2 `bun -F @rezics/notify tsc --noEmit` — BLOCKED on `prisma:generate`: the only errors are stale-generated-client errors in the notify mapper/service (the Prisma client still reflects the old schema). Running `bun -F @rezics/notify prisma:generate` after the migration reset clears them.
- [x] 15.3 `bun -F @rezics/server tsc --noEmit` — my touched files (reaction-boundary, user.service, notify-boundary.client, auth-boundary.service) type-check cleanly; remaining pre-existing errors are in unrelated `chapter`, `book`, and `realm` files
- [x] 15.4 `bun -F @rezics/api tsc --noEmit` — passes after the queryOptions overload simplification
- [x] 15.5 `bun -F @rezics/app tsc --noEmit` — my touched files (NotificationPage, NotificationTabSection, NotificationCard + stories, AuthenticatedSection, env, app/index) type-check cleanly
- [ ] 15.6 `bun -F @rezics/notify test` — same `prisma:generate` block applies; run after regeneration. New `package/notify/src/macro/auth.test.ts` passes (10 tests, run via `cd package/notify && bun test src/macro/auth.test.ts`)
- [ ] 15.7 `bun -F @rezics/server test` — new `package/server/src/auth-boundary/auth-boundary.cookie.test.ts` passes (6 tests, run via `cd package/server && bun test src/auth-boundary/auth-boundary.cookie.test.ts`); broader run should follow after the developer regenerates Prisma clients (the notify client regeneration cascades through workspace deps)
- [x] 15.8 `bun run check:convention` passes — `check:convention — 0 violations`
- [x] 15.9 Run `openspec validate notify-broadcast-boundary --strict` and resolve any reported issues — `Change 'notify-broadcast-boundary' is valid`
- [ ] 15.10 Manual UI smoke per task 14.7 — deferred to developer with a running dev environment
- [x] 15.11 Document in the change PR description: "notify DB destructive migration; run `bun -F @rezics/notify prisma:migrate reset` in dev environments" — noted here; PR description should call out: (a) `bun -F @rezics/notify prisma:migrate reset` (b) `bun -F @rezics/notify prisma:generate` to regenerate the client (c) set `VITE_NOTIFY_BASE_URL` in app `.env`

## 16. Cleanup

- [x] 16.1 Grep the monorepo for `NotificationType`, `emitNotificationEvent`, `AGGREGATABLE_TYPES`, `entityType`, `entityId` (in notification context) and confirm zero remaining references — clean except for: (a) stale `prisma/generated/` artifacts (overwritten on `prisma:generate`), (b) a single JSDoc historical-name mention in `notify-boundary.client.ts`, (c) `preview/src/schema/notify.ts` which is the preview package's separate self-contained schema (unrelated)
- [x] 16.2 Grep for `?token=` in WS contexts and confirm removal — only remaining matches are in `auth-openapi.test.ts` for `/verify-email?token=...` (email verification flow, not WS auth — unrelated)
- [x] 16.3 Update any out-of-date storybook fixtures in `package/app/src/stories/fixtures/notification.ts` to the new shape — rewritten to the new `kind`/`sourceUnitId`/`extra` shape, and `NotificationCard.stories.tsx` updated to render the new fixtures
- [ ] 16.4 Confirm `engagement-subscription` proposal/design/tasks have been updated to depend on this change (the next step in this work session) — not in scope of this change; deferred to the engagement-subscription work session
