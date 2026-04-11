## 1. Package Scaffold

- [ ] 1.1 Create `package/reaction/` directory structure: `src/`, `src/macro/`, `src/reaction/`, `src/internal/`, `src/notify/`, `prisma/`
- [ ] 1.2 Create `package/reaction/package.json` with dependencies: `elysia@^1.4.22`, `@elysiajs/cors`, `prisma@^7.6.0`, `@rezics/contract`, `@rezics/jwt`, `@t3-oss/env-core`, `valibot`, `dotenv`
- [ ] 1.3 Create `package/reaction/tsconfig.json` extending the root config, matching `package/notify/tsconfig.json` pattern
- [ ] 1.4 Register `package/reaction` in root `package.json` workspaces
- [ ] 1.5 Run `bun install` to verify workspace resolution

## 2. Prisma Schema and Database

- [ ] 2.1 Create `package/reaction/prisma/schema.prisma` with `Reaction` and `ReactionSummary` models per design (no FK relations, `VarChar(32)` for reaction, all indexes)
- [ ] 2.2 Create `package/reaction/prisma/client.ts` — Prisma client singleton using `REACTION_DATABASE_URL`
- [ ] 2.3 Add `prisma:generate` and `prisma:migrate` scripts to `package/reaction/package.json`
- [ ] 2.4 Run `bun run prisma:generate` in `package/reaction` to verify schema compiles

## 3. Environment and Configuration

- [ ] 3.1 Create `package/reaction/src/env.ts` — `@t3-oss/env-core` + Valibot validation for all env vars per design (`REACTION_DATABASE_URL`, `REACTION_INTERNAL_SECRET`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_JWT_AUDIENCE`, `NOTIFY_BASE_URL`, `NOTIFY_INTERNAL_SECRET`, `SERVER_BASE_URL`, `SERVER_INTERNAL_SECRET`, `REACTION_TYPES`, `PORT`)
- [ ] 3.2 Parse `REACTION_TYPES` into a `Set<string>` and export as `allowedReactionTypes` for validation

## 4. Auth Macros

- [ ] 4.1 Create `package/reaction/src/macro/auth.ts` — `requireUser` Elysia macro using `@rezics/jwt` (`createJwtVerifier`, `createRemoteJWKSet`) to verify JWT and extract `userId` from `sub` claim. Follow `package/notify/src/macro/auth.ts` pattern.
- [ ] 4.2 Create `package/reaction/src/macro/internal.ts` — `requireInternal` macro verifying `x-internal-secret` header against `REACTION_INTERNAL_SECRET`. Follow `package/notify/src/macro/internal.ts` pattern.

## 5. Contract Schemas

- [ ] 5.1 Create `package/contract/src/reaction/reaction.schema.ts` — Typebox schemas: `createSchema` (`{ targetId: String, reaction: String }`), `deleteQuerySchema` (`{ targetId: String, reaction: String }`), `summaryQuerySchema` (`{ targetIds: String | String[] }`), `myQuerySchema` (`{ targetIds: String | String[] }`)
- [ ] 5.2 Create `package/contract/src/reaction/reaction.types.ts` — shared types: `ReactionDto`, `ReactionSummaryResponse`, `UserReactionsResponse`
- [ ] 5.3 Create `package/contract/src/reaction/internal.ts` — internal schemas: `cleanupBodySchema` (`{ targetId: String }`), `ownerResponseSchema` (`{ ownerId: String }`)
- [ ] 5.4 Create `package/contract/src/reaction/index.ts` — re-export all schemas and types
- [ ] 5.5 Update `package/contract/src/index.ts` to export `./reaction/index.ts`. Remove or deprecate the old `reaction.ts` file (keep until server migration in task group 10).
- [ ] 5.6 Verify contract builds: `cd package/contract && bun run build` (or type-check)

## 6. Reaction Service Core

- [ ] 6.1 Create `package/reaction/src/reaction/reaction.service.ts` — `ReactionService` class with methods: `getSummary(targetIds: string[])`, `getUserReactions(userId: string, targetIds: string[])`, `create(userId, targetId, reaction)`, `remove(userId, targetId, reaction)`. Create and remove use `prisma.$transaction` to maintain Reaction + ReactionSummary atomically. Create validates reaction type against `allowedReactionTypes`. Create returns `{ reaction, created: boolean }` to distinguish new vs idempotent.
- [ ] 6.2 Create `package/reaction/src/reaction/reaction.api.ts` — Elysia router with prefix `/reactions`: `GET /summary` (unauthenticated, summaryQuerySchema), `GET /my` (requireUser, myQuerySchema), `POST /` (requireUser, createSchema), `DELETE /` (requireUser, deleteQuerySchema)
- [ ] 6.3 Verify: write a test for `ReactionService.create` — creates reaction, increments summary, rejects invalid type, idempotent on duplicate

## 7. Internal API

- [ ] 7.1 Create `package/reaction/src/internal/internal.api.ts` — Elysia router with prefix `/internal`: `POST /cleanup` (requireInternal, cleanupBodySchema). Deletes all Reaction and ReactionSummary rows for the given targetId. Returns `{ deleted: true, count }`.
- [ ] 7.2 Verify: write a test for cleanup — creates reactions, calls cleanup, verifies all deleted

## 8. Notification Integration

- [ ] 8.1 Create `package/reaction/src/notify/notify-client.ts` — HTTP client for Notify's `POST /internal/event` and server's `GET /internal/units/owner`. Both fire-and-forget with caught errors logged. Follow `package/server/src/notify/notify-client.ts` pattern.
- [ ] 8.2 Integrate notification into `ReactionService.create`: after successful create (not idempotent), resolve owner via server, if owner != actor send LIKE notification to Notify. All async, non-blocking.

## 9. Server Entry Point

- [ ] 9.1 Create `package/reaction/src/index.ts` — Elysia app assembly: CORS config (same origins as notify), error handler, mount `reactionApi`, mount `internalApi`, health check at `/health`, listen on `PORT` (default 3003)
- [ ] 9.2 Add `dev` and `build` scripts to `package/reaction/package.json` (`bun --watch src/index.ts` for dev, `bun build --compile --minify` for build)
- [ ] 9.3 Add `reaction:dev` script to root `package.json`
- [ ] 9.4 Verify: start the reaction service, hit `/health`, confirm 200 response

## 10. Server-Side Migration (remove reaction domain)

- [ ] 10.1 Create `package/server/src/reaction/reaction-client.ts` — HTTP client for reaction service's `POST /internal/cleanup` endpoint, using `REACTION_BASE_URL` and `REACTION_INTERNAL_SECRET`. Follow `notify-client.ts` pattern.
- [ ] 10.2 Create `package/server/src/internal/internal.api.ts` (or extend existing) — add `GET /internal/units/owner` endpoint protected by `x-internal-secret`. Returns `{ ownerId }` for the given unit ID.
- [ ] 10.3 Add `REACTION_BASE_URL` and `REACTION_INTERNAL_SECRET` to `package/server/src/env.ts`
- [ ] 10.4 Integrate cleanup call: wherever Units are deleted in the server, call `reactionClient.cleanup(targetId)` before or after deletion.
- [ ] 10.5 Remove `package/server/src/reaction/reaction.api.ts` and `reaction.service.ts`
- [ ] 10.6 Remove the `.use(reactionApi)` mount from `package/server/src/index.ts`
- [ ] 10.7 Remove `Reaction` and `ReactionSummary` models from `package/server/prisma/schema.prisma`. Keep `Bookmark` model for later shelf migration.
- [ ] 10.8 Remove Reaction/ReactionSummary relations from the `Unit` and `User` models in server schema
- [ ] 10.9 Run `bun run prisma:generate` in `package/server` to verify schema compiles without reaction models
- [ ] 10.10 Remove the old `package/contract/src/reaction.ts` file. Update any server imports to use `@rezics/contract/reaction` (new path).
- [ ] 10.11 Grep for remaining `reaction` imports in `package/server` and fix any broken references
- [ ] 10.12 Verify: `cd package/server && bun run build` (or type-check) succeeds

## 11. API Client Rewrite

- [ ] 11.1 Update `package/api/src/reaction/reaction.api.ts` — point base URL to `VITE_REACTION_SERVICE_URL` env var instead of server URL. Remove bookmark-related functions (`getBookmarkTags`, `setBookmarkTags`). Remove `list` and `update` functions. Adjust `summary` and `my` to use new response shapes.
- [ ] 11.2 Update `package/api/src/reaction/reaction.types.ts` — align with new contract types, remove bookmark types
- [ ] 11.3 Update `package/api/src/reaction/reaction.keys.ts` — remove `bookmarkTags` key, remove `list` key
- [ ] 11.4 Update `package/api/src/reaction/reaction.queries.ts` — remove bookmark queries, update summary/my query options
- [ ] 11.5 Update `package/api/src/reaction/reaction.mutations.ts` — remove `useSetBookmarkTagsMutation`, remove `useUpdateReactionMutation`, update invalidation keys
- [ ] 11.6 Update `package/api/src/reaction/reaction.ts` — update re-exports
- [ ] 11.7 Verify: type-check `package/api`

## 12. Frontend Updates

- [ ] 12.1 Update `package/app/src/engagement/component/ReactionBar.tsx` — remove bookmark icon and `BookmarkTagManager` integration. Keep like, dislike, reply, share.
- [ ] 12.2 Update `package/app/src/engagement/component/MiniActionBar.tsx` — remove bookmark icon. Keep like, reply.
- [ ] 12.3 Remove `package/app/src/engagement/component/BookmarkTagManager.tsx`
- [ ] 12.4 Remove `package/app/src/user/component/Bookmark/BookmarkItemCard.tsx` and parent directory if empty
- [ ] 12.5 Remove `package/app/src/user/page/UserBookmarkTagsCard.tsx`
- [ ] 12.6 Remove `package/app/src/user/page/BookmarkPage.tsx` and its route registration
- [ ] 12.7 Update `package/app/src/user/page/ReactionInfoPage.tsx` — remove bookmark tab, keep reaction history tab
- [ ] 12.8 Update `package/app/src/shared/util/reaction-summaries-parser.ts` — remove bookmark count extraction
- [ ] 12.9 Add `VITE_REACTION_SERVICE_URL` to `package/app/src/env.ts` (or equivalent Vite env config)
- [ ] 12.10 Grep for remaining bookmark/`BookmarkTagManager`/`BookmarkItemCard` imports in `package/app` and fix broken references
- [ ] 12.11 Verify: `cd package/app && bun run build` succeeds with no type errors

## 13. Data Migration Script

- [ ] 13.1 Create `package/reaction/scripts/migrate-from-server.ts` — connects to both server DB and reaction DB. Copies `Reaction` rows where `reaction NOT IN ('bookmark', 'comment')` and corresponding `ReactionSummary` rows. Logs count of migrated rows.
- [ ] 13.2 Add row count verification: after copy, compare counts between source and destination
- [ ] 13.3 Verify: run against a test database, confirm data integrity

## 14. Dev Environment Integration

- [ ] 14.1 Update `zellij-layout` (or tmux config) referenced by `bun run dev` to include the reaction service
- [ ] 14.2 Create `package/reaction/.env.example` with all required env vars
- [ ] 14.3 Verify: `bun run dev` starts server, auth, notify, and reaction services together
