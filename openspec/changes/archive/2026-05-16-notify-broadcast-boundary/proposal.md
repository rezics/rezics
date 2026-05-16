## Why

The notify service (`package/notify`) exists as a standalone Elysia process with its own database, internal API for emitting events, an SSE stream, and a DM transport — but it is **not actually integrated end-to-end**:

- The frontend has zero notification data fetching: `package/api/src/notification/` does not exist; `NotificationPage.tsx` renders only an `AccentBarWithText` placeholder; `NotificationTabSection.tsx` is a literal `return <div>NotificationTabSection</div>`.
- No SSE client has ever been written. The notify `/stream` endpoint runs but no browser ever connects.
- Worse, notify's `requireUser` macro accepts only `Authorization: Bearer`, while `rezics-session-token` is now stored in an `HttpOnly` cookie that JavaScript cannot read. The browser cannot authenticate to notify today even if a client existed.

Independently, the in-flight `engagement-subscription` change introduces a generic broadcast event model `{ kind, sourceUnitId, payload? }` whose recipient set is computed from the new `Subscription` table. The current `/internal/event` body is single-recipient and locked to a closed `NotificationType` enum (`LIKE`/`FAVORITE`/`FOLLOW`/`COMMENT`/`MENTION`/`SYSTEM`/`INVITATION`) — incompatible with a kind-namespaced broadcast model and incapable of carrying a resolved recipient set.

Both gaps must close before `engagement-subscription` can land cleanly. This change does the close: it formally integrates notify into the app (auth, hooks, SSE client, UI surface), reshapes the boundary contract to accept resolved-broadcast events, and codifies the cross-service cookie trust boundary that the integration depends on as a first-class security spec.

## What Changes

### Cross-service session cookie scope (foundation)

- **NEW** capability `subdomain-trust-boundary`: documents the four invariants that make `Domain=.rezics.com` cookie scoping safe across first-party services (no untrusted content on `*.rezics.com`, DNS hygiene, logout symmetry, XSS still session-equivalent).
- **MODIFIED** server cookie builder: `rezics-session-token` SHALL be set with `Domain=.rezics.com` in production (no `Domain` attribute in dev for `localhost`), `SameSite=Lax`, `HttpOnly`, `Secure` (prod only). `book.rezics.com` and `notify.rezics.com` are same-site (eTLD+1 = `rezics.com`) so Lax allows browser-mediated cross-origin requests between them while still blocking genuinely cross-site CSRF.

### Notify auth: cookie support

- **MODIFIED** `notify-auth`: the `requireUser` macro SHALL accept `rezics-session-token` from EITHER `Authorization: Bearer` OR the `Cookie` header (mirroring server's `resolveSessionToken`). Bearer remains for non-browser callers (CLI, internal tooling, future mobile clients). The notify CORS config SHALL set `credentials: true` and allow `https://*.rezics.com` in prod (`http://localhost:*` in dev).

### Boundary contract: broadcast event shape

- **MODIFIED** `internal-event-ingestion`: `POST /internal/event` SHALL accept `{ kind: string, sourceUnitId: string, recipientIds: string[], actorId?: string, extra?: Json }`. Recipient resolution SHALL be done by the caller (the server), not by notify. Notify SHALL persist one row per recipient via `prisma.notification.createMany` and SSE-push to each connected recipient in the same request cycle.
- **REMOVED** the legacy `{ recipientId, type, entityType, entityId, meta }` single-recipient body. The closed `NotificationType` enum is dropped from notify's Prisma schema. `type` is replaced by `kind String` (free-form, registry-validated server-side); `entityType`/`entityId` collapse into `sourceUnitId String`. The `meta` column is renamed to `extra` to align with server-side `extra Json?` schema convention (eleven occurrences across the server schema, zero `meta`).
- **NEW** `KIND_REGISTRY` in `@rezics/contract`: a flat map keyed by event kind declaring `{ aggregatable, category }`. v1 entries: `reaction.like`, `reaction.favorite`, `follow.new`, `comment.new`, `mention.new`, `system.notice`, `invitation.new`. Engagement-subscription extends the registry as it adds new kinds.
- **NEW** server-side `notifyBoundary.broadcast(event)` helper in `package/server/src/notify-boundary/`. v1 implementation resolves `recipientIds` from `event.directRecipients` only; engagement-subscription extends the helper body to union with `Subscription` query results. The helper signature is the contract this change locks in.

### Direct-messaging WS auth: cookie on handshake

- **MODIFIED** `direct-messaging`: `WS /dm` SHALL authenticate via the `rezics-session-token` cookie sent on the WebSocket upgrade request. The legacy `?token=<jwt>` query parameter SHALL be removed (development-stage clean cutover).

### Notification feed: schema and aggregation key migration

- **MODIFIED** `notification-feed`: notification rows store `kind String`, `sourceUnitId String`, `extra Json?`. Aggregation groups by `(recipientId, kind, sourceUnitId)` (replacing `(recipientId, type, entityType, entityId)`). Mark-as-read body shape changes from `(type, entityType, entityId)` to `(kind, sourceUnitId)`. Aggregatability per kind is read from `KIND_REGISTRY` instead of a hardcoded `AGGREGATABLE_TYPES` constant.

### Notification stream: cookie auth + frontend client

- **MODIFIED** `notification-stream`: `GET /stream` SHALL authenticate via the `rezics-session-token` cookie. The frontend SHALL use `new EventSource(url, { withCredentials: true })` so the cookie is sent cross-origin within the same registrable domain.

### Frontend integration (the "currently not connected" gap)

- **NEW** `package/api/src/notification/`: TanStack Query hooks `useNotifications`, `useUnreadCount`, `useMarkAsRead`, `useMarkAllAsRead`, `useDeleteNotification`, plus query options modules.
- **NEW** `useNotificationStream` SSE client hook opening notify's `/stream` with `withCredentials: true`, dispatching events into the TanStack Query cache (invalidate `['notifications']` and `['notifications', 'unread-count']`, optionally optimistic-prepend the raw event into the list cache).
- **MODIFIED** `package/app/src/inbox/pages/NotificationPage.tsx` and `NotificationTabSection.tsx`: render the real list against the hooks; mark-as-read affordances; empty / loading / error states.
- **NEW** unread-count badge on the header bell (driven by `useUnreadCount` + SSE-driven invalidation).

### Migration of existing emit call sites

- All four current callers (`reaction-boundary.api.ts`, `user.service.ts`, `unit/work-link.service.ts`, `unit/work-link-claim.service.ts`) migrate to `notifyBoundary.broadcast({ kind, sourceUnitId, directRecipients: [...], actorId?, extra? })`. The legacy `emitNotificationEvent` function is removed. No compat shim — one clean PR per project policy.

### Out of scope (explicit non-goals)

- DM permission rules (sender/recipient gating on subscription instead of follow) — moves to `engagement-subscription`.
- DM inbox UI (conversation list, message thread, send box) — moves to `engagement-subscription` since DM permission lives there.
- `notify-system-email` flow — independent capability, unchanged.
- EventBus / queue abstraction — inline dispatch through the helper; defer queue introduction.
- Hotness ranking, rate limiting, batched-insert tuning beyond `createMany` — deferred.

## Capabilities

### New Capabilities

- `subdomain-trust-boundary`: invariants and cookie-scope rules that make sharing the session cookie across `*.rezics.com` services safe.

### Modified Capabilities

- `notify-auth`: cookie auth accepted alongside Bearer.
- `internal-event-ingestion`: broadcast event shape with pre-resolved `recipientIds`; legacy single-recipient body removed.
- `notification-feed`: schema migration (`kind`/`sourceUnitId`/`extra`) and aggregation key shift.
- `notification-stream`: cookie auth via `withCredentials`.
- `direct-messaging`: WS cookie auth on handshake; query-parameter token removed.

## Impact

**Affected packages**:

- `package/notify`
  - Prisma migration: drop `NotificationType` enum, drop `type`/`entityType`/`entityId` columns, add `kind String` and `sourceUnitId String`, rename `meta`→`extra`. Recreate indexes on `(recipientId, read)`, `(recipientId, kind, sourceUnitId)`, `(recipientId, createdAt DESC)`. Dev-only DB; no data backfill.
  - `macro/auth.ts`: read token from `Authorization` OR `Cookie` (`rezics-session-token` cookie name).
  - `internal/internal.api.ts`: `/internal/event` accepts the new broadcast body; uses `prisma.notification.createMany` for batched persistence and iterates SSE fan-out for connected recipients.
  - `notification/notification.service.ts`: aggregation by `(kind, sourceUnitId)`; `markAsRead` body shape updated; `getNotifications` raw SQL groups by new key.
  - `notification/notification.mapper.ts`: rewrite for new row shape.
  - `dm/dm.api.ts`: WS handler reads cookie from upgrade request `headers.cookie`; drop `?token=` extraction path.
  - `index.ts`: CORS config updates — `credentials: true`, `origin: https://*.rezics.com` (prod) and `http://localhost:*` (dev).

- `package/server`
  - `notify-boundary/notify-boundary.client.ts`: new `broadcast(event)` function; remove `emitNotificationEvent`. The `sendDm` and `notifySystemAndEmail` helpers are unchanged in shape (DM permission re-gate happens in `engagement-subscription`).
  - All four existing emit call sites migrate to `broadcast` with `directRecipients`.
  - `auth-boundary/auth-boundary.service.ts`: cookie builder gains `Domain=.rezics.com` in prod; logout flow uses the same `Domain` attribute when clearing.

- `package/contract`
  - New `notification/kind-registry.ts` exporting `KIND_REGISTRY` (flat map) and `isValidKind(kind)` predicate.
  - `notify/internal.ts`: replace `internalEventBodySchema` with `internalBroadcastBodySchema` of the new shape; remove the old single-recipient schema.
  - `notify/notification.ts`: schemas updated for new aggregation key (`kind`/`sourceUnitId` everywhere `type`/`entityType`/`entityId` appeared); `AGGREGATABLE_TYPES` constant removed in favor of registry lookup.

- `package/api`
  - New `notification/` module with the five TanStack Query hooks and query-options modules.
  - New `useNotificationStream` SSE client hook.

- `package/app`
  - Real `NotificationPage` and `NotificationTabSection` rendering against hooks.
  - Header bell badge (existing `AuthenticatedSection` or `MainNavigation`).
  - `useNotificationStream` mounted at app shell level after login.

**Dependencies**:

- This change is a **hard prerequisite** of `engagement-subscription`. It introduces:
  - The `notifyBoundary.broadcast(event)` helper signature that engagement-subscription extends with subscription-table resolution.
  - The `KIND_REGISTRY` that engagement-subscription adds new kinds to (`chapter.new`, `chapter.updated`, `review.new`, `member.joined`, etc.).
  - The cookie scope that engagement-subscription's frontend hooks rely on.
- No dependency on `user-namespace-slug` (L3). Can land in parallel with or before it.

**Backward compatibility**:

Development-stage breaking change per `CLAUDE.md` policy. Notify DB is dev-only; clean cutover with a `prisma migrate reset` + new init migration is acceptable (alternative: a destructive ALTER migration that drops columns and the enum). No compat shim for `emitNotificationEvent` — call sites migrate in the same PR. The `?token=` WS query parameter is removed cleanly.

**Performance & indexing**:

- `Notification` table indexes recreated for the new key shape; aggregation cost is unchanged (still a single grouped SELECT per page render).
- `createMany` for batched persistence: a `chapter.new` to 10k subscribers becomes one INSERT instead of 10k round-trips through the boundary client.
- SSE fan-out remains in-process; only connected recipients are pushed to.
