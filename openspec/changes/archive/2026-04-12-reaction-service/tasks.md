## 1. Package Scaffold

- [x] 1.1 Create `package/reaction/` directory structure: `src/`, `src/macro/`, `src/reaction/`, `src/internal/`, `src/notify/`, `prisma/`
- [x] 1.2 Create `package/reaction/package.json` with dependencies: `elysia@^1.4.22`, `@elysiajs/cors`, `prisma@^7.6.0`, `@rezics/contract`, `@rezics/jwt`, `@t3-oss/env-core`, `valibot`, `dotenv`
- [x] 1.3 Create `package/reaction/tsconfig.json` extending the root config, matching `package/notify/tsconfig.json` pattern
- [x] 1.4 Register `package/reaction` in root `package.json` workspaces
- [x] 1.5 Run `bun install` to verify workspace resolution

## 2. Prisma Schema and Database

- [x] 2.1 Create `package/reaction/prisma/schema.prisma` with `Reaction` and `ReactionSummary` models per design (no FK relations, `VarChar(32)` for reaction, all indexes)
- [x] 2.2 Create `package/reaction/prisma/client.ts` — Prisma client singleton using `REACTION_DATABASE_URL`
- [x] 2.3 Add `prisma:generate` and `prisma:migrate` scripts to `package/reaction/package.json`
- [x] 2.4 Run `bun run prisma:generate` in `package/reaction` to verify schema compiles

## 3. Environment and Configuration

- [x] 3.1 Create `package/reaction/src/env.ts` — `@t3-oss/env-core` + Valibot validation for env vars (`REACTION_DATABASE_URL`, `REACTION_INTERNAL_SECRET`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_JWT_AUDIENCE`, `REACTION_TYPES`, `PORT`). Note: `NOTIFY_*` and `SERVER_*` vars removed — reaction service no longer makes outbound calls.
- [x] 3.2 Parse `REACTION_TYPES` into a `Set<string>` and export as `allowedReactionTypes` for validation

## 4. Auth Macros

- [x] 4.1 Create `package/reaction/src/macro/auth.ts` — `requireUser` Elysia macro using `@rezics/jwt` (`createJwtVerifier`, `createRemoteJWKSet`) to verify JWT and extract `userId` from `sub` claim. Follow `package/notify/src/macro/auth.ts` pattern.
- [x] 4.2 Create `package/reaction/src/macro/internal.ts` — `requireInternal` macro verifying `x-internal-secret` header against `REACTION_INTERNAL_SECRET`. Follow `package/notify/src/macro/internal.ts` pattern.

## 5. Contract Schemas

- [x] 5.1 Create `package/contract/src/reaction/reaction.schema.ts` — Typebox schemas: `createSchema` (`{ targetId: String, reaction: String }`), `deleteQuerySchema` (`{ targetId: String, reaction: String }`), `summaryQuerySchema` (`{ targetIds: String | String[] }`), `myQuerySchema` (`{ targetIds: String | String[] }`)
- [x] 5.2 Create `package/contract/src/reaction/reaction.types.ts` — shared types: `ReactionDto`, `ReactionSummaryResponse`, `UserReactionsResponse`
- [x] 5.3 Create `package/contract/src/reaction/internal.ts` — internal schemas: `cleanupBodySchema`, `internalCreateBodySchema`, `internalCreateResponseSchema`, `internalRemoveBodySchema`, `internalRemoveResponseSchema`
- [x] 5.4 Create `package/contract/src/reaction/index.ts` — re-export all schemas and types
- [x] 5.5 Update `package/contract/src/index.ts` to export `./reaction/index.ts`. Remove or deprecate the old `reaction.ts` file (keep until server migration in task group 10).
- [x] 5.6 Verify contract builds: `cd package/contract && bun run build` (or type-check)

## 6. Reaction Service Core

- [x] 6.1 Create `package/reaction/src/reaction/reaction.service.ts` — `ReactionService` class with methods: `getSummary(targetIds: string[])`, `getUserReactions(userId: string, targetIds: string[])`, `create(userId, targetId, reaction)`, `remove(userId, targetId, reaction)`. Create and remove use `prisma.$transaction` to maintain Reaction + ReactionSummary atomically. Create validates reaction type against `allowedReactionTypes`. Create returns `{ reaction, created: boolean }` to distinguish new vs idempotent.
- [x] 6.2 Create `package/reaction/src/reaction/reaction.api.ts` — Elysia router with prefix `/reactions`: `GET /summary` (unauthenticated, summaryQuerySchema), `GET /my` (requireUser, myQuerySchema). Write endpoints (`POST /`, `DELETE /`) removed — writes are now routed through the main server.
- [ ] 6.3 Verify: write a test for `ReactionService.create` — creates reaction, increments summary, rejects invalid type, idempotent on duplicate

## 7. Internal API

- [x] 7.1 Create `package/reaction/src/internal/internal.api.ts` — Elysia router with prefix `/internal`: `POST /cleanup`, `POST /create`, `POST /remove` (all requireInternal). Create and remove proxy to `reactionService` methods. Cleanup deletes all Reaction and ReactionSummary rows for the given targetId.
- [ ] 7.2 Verify: write a test for cleanup — creates reactions, calls cleanup, verifies all deleted

## 8. Notification Integration (moved to server)

- [x] 8.1 ~~Create `package/reaction/src/notify/notify-client.ts`~~ — **Removed.** Notification logic moved to the main server. The reaction service no longer makes outbound calls.
- [x] 8.2 Server-side notification dispatch: `package/server/src/reaction/reaction.api.ts` dispatches LIKE notification via `emitNotificationEvent()` after successful create (not idempotent), resolving owner via `prisma.unit.findUnique`. Fire-and-forget.

## 9. Server Entry Point

- [x] 9.1 Create `package/reaction/src/index.ts` — Elysia app assembly: CORS config (same origins as notify), error handler, mount `reactionApi`, mount `internalApi`, health check at `/health`, listen on `PORT` (default 3003)
- [x] 9.2 Add `dev` and `build` scripts to `package/reaction/package.json` (`bun --watch src/index.ts` for dev, `bun build --compile --minify` for build)
- [x] 9.3 Add `reaction:dev` script to root `package.json`
- [ ] 9.4 Verify: start the reaction service, hit `/health`, confirm 200 response

## 10. Server-Side Migration (remove reaction domain)

- [x] 10.1 Create `package/server/src/reaction/reaction-client.ts` — HTTP client for reaction service's internal endpoints (`/internal/create`, `/internal/remove`, `/internal/cleanup`), using `REACTION_BASE_URL` and `REACTION_INTERNAL_SECRET`.
- [x] 10.2 Create `package/server/src/reaction/reaction.api.ts` — Elysia router with `POST /reactions` and `DELETE /reactions` endpoints that proxy writes to the reaction service and dispatch notifications.
- [x] 10.3 Add `REACTION_BASE_URL` and `REACTION_INTERNAL_SECRET` to `package/server/src/env.ts`
- [x] 10.4 Integrate cleanup call: wherever Units are deleted in the server, call `reactionClient.cleanup(targetId)` before or after deletion.
- [x] 10.5 Remove `package/server/src/reaction/reaction.api.ts` and `reaction.service.ts`
- [x] 10.6 Remove the `.use(reactionApi)` mount from `package/server/src/index.ts`
- [x] 10.7 Remove `Reaction` and `ReactionSummary` models from `package/server/prisma/schema.prisma`. Keep `Bookmark` model for later shelf migration.
- [x] 10.8 Remove Reaction/ReactionSummary relations from the `Unit` and `User` models in server schema
- [x] 10.9 Run `bun run prisma:generate` in `package/server` to verify schema compiles without reaction models
- [x] 10.10 Remove the old `package/contract/src/reaction.ts` file. Update any server imports to use `@rezics/contract/reaction` (new path).
- [x] 10.11 Grep for remaining `reaction` imports in `package/server` and fix any broken references
- [x] 10.12 Verify: `cd package/server && bun run build` (or type-check) succeeds

## 11. API Client Rewrite

- [x] 11.1 Update `package/api/src/reaction/reaction.api.ts` — reads (`summary`, `my`) go to `VITE_REACTION_SERVICE_URL` (reaction service direct). Writes (`create`, `remove`) use `apiFetch` to route through the main server (`apiBaseUrl`). Remove bookmark-related functions.
- [x] 11.2 Update `package/api/src/reaction/reaction.types.ts` — align with new contract types, remove bookmark types
- [x] 11.3 Update `package/api/src/reaction/reaction.keys.ts` — remove `bookmarkTags` key, remove `list` key
- [x] 11.4 Update `package/api/src/reaction/reaction.queries.ts` — remove bookmark queries, update summary/my query options
- [x] 11.5 Update `package/api/src/reaction/reaction.mutations.ts` — remove `useSetBookmarkTagsMutation`, remove `useUpdateReactionMutation`, update invalidation keys
- [x] 11.6 Update `package/api/src/reaction/reaction.ts` — update re-exports
- [x] 11.7 Verify: type-check `package/api`

## 12. Frontend Updates

- [x] 12.1 Update `package/app/src/engagement/component/ReactionBar.tsx` — remove bookmark icon and `BookmarkTagManager` integration. Keep like, dislike, reply, share.
- [x] 12.2 Update `package/app/src/engagement/component/MiniActionBar.tsx` — remove bookmark icon. Keep like, reply.
- [x] 12.3 Remove `package/app/src/engagement/component/BookmarkTagManager.tsx`
- [x] 12.4 Remove `package/app/src/user/component/Bookmark/BookmarkItemCard.tsx` and parent directory if empty
- [x] 12.5 Remove `package/app/src/user/page/UserBookmarkTagsCard.tsx`
- [x] 12.6 Remove `package/app/src/user/page/BookmarkPage.tsx` and its route registration
- [x] 12.7 Update `package/app/src/user/page/ReactionInfoPage.tsx` — remove bookmark tab, keep reaction history tab
- [x] 12.8 Update `package/app/src/shared/util/reaction-summaries-parser.ts` — remove bookmark count extraction
- [x] 12.9 Add `VITE_REACTION_SERVICE_URL` to `package/app/src/env.ts` (or equivalent Vite env config)
- [x] 12.10 Grep for remaining bookmark/`BookmarkTagManager`/`BookmarkItemCard` imports in `package/app` and fix broken references
- [x] 12.11 Verify: `cd package/app && bun run build` succeeds with no type errors

## 13. Data Migration Script

- [x] 13.1 Create `package/reaction/scripts/migrate-from-server.ts` — connects to both server DB and reaction DB. Copies `Reaction` rows where `reaction NOT IN ('bookmark', 'comment')` and corresponding `ReactionSummary` rows. Logs count of migrated rows.
- [x] 13.2 Add row count verification: after copy, compare counts between source and destination
- [ ] 13.3 Verify: run against a test database, confirm data integrity

## 14. Dev Environment Integration

- [x] 14.1 Update `zellij-layout` (or tmux config) referenced by `bun run dev` to include the reaction service
- [x] 14.2 Create `package/reaction/.env.example` with all required env vars
- [ ] 14.3 Verify: `bun run dev` starts server, auth, notify, and reaction services together
