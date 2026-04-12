## 1. Package Scaffold

- [x] 1.1 Create `package/notify/` with `package.json` (name: `@rezics/notify`, dependencies: `elysia@^1.4.22`, `@rezics/contract`, `@rezics/jwt`), `tsconfig.json`, and directory structure (`src/`, `prisma/`)
- [x] 1.2 Create `package/notify/src/env.ts` with `@t3-oss/env-core` + Valibot validation for `NOTIFY_DATABASE_URL`, `NOTIFY_INTERNAL_SECRET`, `AUTH_JWKS_URL`, `PORT`
- [x] 1.3 Create Prisma schema at `package/notify/prisma/schema.prisma` with `Notification`, `Conversation`, `Message` models and all indexes
- [x] 1.4 Create `package/notify/prisma/client.ts` with PrismaPg adapter (matching server/auth pattern: pooling, dev logging, graceful shutdown)
- [x] 1.5 Run `prisma generate` and verify client compiles
- [x] 1.6 Register `package/notify` in root workspace (`package.json` workspaces array)

## 2. Contract Schemas

- [x] 2.1 Create `package/contract/src/notify/` folder with `index.ts`
- [x] 2.2 Define `NotificationType` enum and notification event payload schema in `package/contract/src/notify/notification.ts` (Typebox)
- [x] 2.3 Define DM message and conversation schemas in `package/contract/src/notify/dm.ts` (Typebox)
- [x] 2.4 Define internal event and DM request/response schemas in `package/contract/src/notify/internal.ts` (Typebox)
- [x] 2.5 Export notify schemas from `package/contract/src/index.ts`
- [x] 2.6 Verify contract package compiles

## 3. Auth Layer

- [x] 3.1 Create `package/notify/src/macro/auth.ts` — `requireUser` Elysia macro using `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` to verify auth JWTs and populate `userId` from `sub` claim
- [x] 3.2 Create internal secret verification guard for `x-internal-secret` header — reusable Elysia middleware for internal endpoints

## 4. Notification Feed

- [x] 4.1 Create `package/notify/src/notification/notification.service.ts` — query-time aggregation via `GROUP BY (type, entity_type, entity_id)` for aggregatable types (LIKE, FAVORITE, FOLLOW), individual rows for non-aggregatable types (COMMENT, MENTION, SYSTEM, INVITATION)
- [x] 4.2 Implement `getUnreadCount` in notification service — count of distinct aggregated groups with at least one unread row
- [x] 4.3 Implement `markAsRead` by aggregation key `(type, entityType, entityId)` — update all matching rows for recipient
- [x] 4.4 Implement `markAllAsRead` for recipient
- [x] 4.5 Implement `deleteNotification` with ownership check (recipientId must match userId)
- [x] 4.6 Create `package/notify/src/notification/notification.mapper.ts` — transform raw rows to aggregated response shape (actorIds array, count, latestAt, allRead)
- [x] 4.7 Create `package/notify/src/notification/notification.api.ts` — Elysia routes: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read`, `POST /notifications/read-all`, `DELETE /notifications/:id` (all with `requireUser` macro)

## 5. SSE Notification Stream

- [x] 5.1 Create `package/notify/src/stream/fan-out.ts` — in-process `Map<userId, Set<connection>>` with `subscribe`, `unsubscribe`, and `publish` methods
- [x] 5.2 Create `package/notify/src/stream/stream.api.ts` — `GET /stream` SSE endpoint with `requireUser` macro, heartbeat every 30s, cleanup on disconnect
- [x] 5.3 Integrate fan-out with internal event ingestion — on notification insert, call `fanOut.publish(recipientId, event)`

## 6. Direct Messaging

- [x] 6.1 Create `package/notify/src/dm/dm.service.ts` — conversation upsert (lexicographic participant ordering), message insertion, message history with pagination, conversation listing, read tracking
- [x] 6.2 Create `package/notify/src/dm/dm.api.ts` — `GET /dm/conversations`, `GET /dm/conversations/:id/messages` (with `requireUser` macro and participant ownership check)
- [x] 6.3 Implement WebSocket endpoint `WS /dm?token=<jwt>` — token validation on connect (close 4001 on failure), receive-only stream for incoming messages, multi-connection fan-out per userId
- [x] 6.4 Integrate DM fan-out — on message insert via internal endpoint, push to recipient's WebSocket connections

## 7. Internal Endpoints

- [x] 7.1 Create `package/notify/src/internal/internal.api.ts` — `POST /internal/event` (validate secret, persist notification, trigger SSE fan-out)
- [x] 7.2 Add `POST /internal/dm` to internal API (validate secret, upsert conversation, persist message, trigger WS fan-out)

## 8. App Assembly

- [x] 8.1 Create `package/notify/src/index.ts` — Elysia root app, mount notification API, stream API, DM API, internal API, CORS config, error handler
- [x] 8.2 Add `dev` and `build` scripts to `package/notify/package.json` (matching server/auth pattern)
- [x] 8.3 Verify the notify service starts and connects to the database

## 9. Server Integration

- [x] 9.1 Add `NOTIFY_BASE_URL` and `NOTIFY_INTERNAL_SECRET` to `package/server/src/env.ts`
- [x] 9.2 Create internal HTTP client utility in server for calling Notify's internal endpoints (fetch-based, shared secret header)
- [x] 9.3 Emit notification events from server domain actions: like, favorite, comment, mention, follow — call `POST /internal/event` on Notify with entity meta snapshots
- [x] 9.4 Create `POST /dm/send` endpoint on server — validate DM permissions (follow status, blocks), forward to Notify's `POST /internal/dm`
- [x] 9.5 Create `GET /users/batch` endpoint on server — accept comma-separated user IDs, return `{ [id]: { name, slug, avatar } }` for notification actor resolution

## 10. Validation

- [x] 10.1 Verify all packages compile (`bun run build` or `tsc --noEmit` in notify, contract, server)
- [x] 10.2 Test notification CRUD: create via internal endpoint, list with aggregation, mark read, delete
- [x] 10.3 Test SSE stream: connect, receive live notification, heartbeat
- [x] 10.4 Test DM flow: server-mediated send, conversation creation, message delivery via WebSocket
- [x] 10.5 Test auth: valid JWT accepted, invalid JWT rejected, missing secret rejected
