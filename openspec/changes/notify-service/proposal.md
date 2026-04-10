## Why

Rezics has no real-time communication layer. Users receive no in-app feedback when someone likes their book, comments on a chapter, or sends them a direct message. All notification-worthy events are fire-and-forget from the server's perspective. A dedicated Notify service fills this gap — it owns the notification feed, real-time streaming, and direct messaging, decoupled from the main server so it can scale and deploy independently.

## What Changes

- **New `package/notify` service** — standalone Elysia server with its own PostgreSQL database (Prisma 7). Handles notification persistence, query-time aggregation, SSE streaming, and WebSocket-based DM delivery.
- **New `@rezics/contract` notify schemas** — shared Typebox schemas for notification types, event payloads, and DM message shapes under `package/contract/src/notify/`.
- **Server-side integration** — `@rezics/server` gains internal HTTP calls to Notify's `/internal/event` and `/internal/dm` endpoints when domain events occur (like, favorite, comment, mention, follow). Server also gains `POST /dm/send` (validates DM permissions, forwards to Notify) and `GET /users/batch` (batch user profile resolution for frontend).
- **Frontend integration** — `@rezics/app` connects to Notify's SSE stream for live notification push and Notify's WebSocket for real-time DM delivery. Notification rendering resolves actor data via server batch endpoint (hybrid meta: entity snapshots stored in Notify, actor profiles fetched fresh).

## Capabilities

### New Capabilities

- `notification-feed`: Notification persistence, query-time aggregation (group by type+entity), read/unread state, unread count, deletion
- `notification-stream`: SSE-based real-time push of raw notification events to connected users, with heartbeat keep-alive
- `direct-messaging`: Bilateral conversations with message persistence, server-mediated send authorization, WebSocket receive-only delivery
- `internal-event-ingestion`: Shared-secret-protected HTTP endpoint for trusted backend services to emit notification events and DM messages
- `notify-auth`: JWT verification of user identity via auth JWKS for read endpoints; shared secret verification for internal write endpoints

### Modified Capabilities

_(none — no existing spec-level behavior changes)_

## Impact

**Affected packages:**
- `package/notify` — new package
- `package/contract` — new `src/notify/` folder with shared schemas
- `package/server` — new internal HTTP client for Notify, new `POST /dm/send` endpoint, new `GET /users/batch` endpoint
- `package/app` — new notification UI, SSE connection, WebSocket DM connection, batch user resolution

**Dependencies added:**
- `package/notify`: `elysia@^1.4.22`, `prisma@^7.6.0`, `@rezics/contract`, `@rezics/jwt`
- `package/server`: HTTP client for Notify internal endpoints (fetch-based, no new dependency)

**New infrastructure:**
- Separate PostgreSQL database for Notify (`NOTIFY_DATABASE_URL`)
- `NOTIFY_INTERNAL_SECRET` shared between server/auth and notify

**Backward compatibility:** No breaking changes. All additions are new surface area. Existing server and auth APIs are unchanged.
