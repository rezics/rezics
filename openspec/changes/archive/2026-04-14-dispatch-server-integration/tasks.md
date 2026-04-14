## 1. Contract — Dispatch Types and Schemas

- [x] 1.1 Create `package/contract/src/dispatch/` module with `DispatchType` enum (`rezics:book`, `rezics:game`, `rezics:media`) as Typebox literals
- [x] 1.2 Define `dispatchResultSchema` envelope (taskId, project, type, unitId?, data) in `package/contract/src/dispatch/dispatch.ts`
- [x] 1.3 Export dispatch scope constants (domain: `"dispatch"`, permissions: `"rezics-server-session"`, `"unit:update"`, `"unit:create"`) in the dispatch contract module
- [x] 1.4 Re-export dispatch module from `package/contract/src/index.ts`
- [x] 1.5 Verify contract builds cleanly (`bun run build` or type-check in `package/contract`)

## 2. Server — Token Session Endpoint

- [x] 2.1 Add `POST /token/session` route in `package/server/src/token/token.api.ts` — authenticate via `tokenService.authenticateFromHeader()`, check `dispatch:rezics-server-session` scope
- [x] 2.2 Look up token owner's user record (unitId, permission.role) from database
- [x] 2.3 Call `signRezicsSessionToken({ unitId, role })` and return `{ token }` with status 200
- [x] 2.4 Handle error cases: 401 (invalid token), 403 (missing scope), 404 (user not found)
- [x] 2.5 Write tests for the token session endpoint (success, missing scope, invalid token, user not found)

## 3. Server — Dispatch Module Setup

- [x] 3.1 Create `package/server/src/dispatch/` directory with `dispatch.api.ts`, `dispatch.service.ts`, `dispatch.types.ts`
- [x] 3.2 Add dispatch environment variables (`DISPATCH_HUB_URL`, `DISPATCH_RECEIPT_SECRET`, `DISPATCH_PROJECT_ID`) to env validation
- [x] 3.3 Mount `dispatchApi` in `package/server/src/index.ts` via `.use()`

## 4. Server — Result Intake Endpoint

- [x] 4.1 Implement `POST /dispatch/results` route in `dispatch.api.ts` — authenticate via `tokenService.authenticateFromHeader()`, validate payload against `dispatchResultSchema`
- [x] 4.2 Implement permission check: require `dispatch:unit:update` scope; if no `unitId`, additionally require `dispatch:unit:create` scope
- [x] 4.3 Implement result processing in `dispatch.service.ts` — route by `type` to appropriate Prisma upsert logic (book, game, media)
- [x] 4.4 Implement hub audit notification: HMAC-SHA256 signing of sorted taskIds + project, `POST` to `DISPATCH_HUB_URL/tasks/audit`
- [x] 4.5 Implement retry logic for hub notification: up to 3 retries with exponential backoff (1s, 2s, 4s), log on exhaustion
- [x] 4.6 Handle graceful degradation: if dispatch env vars are missing, return 503 from the results endpoint

## 5. Validation and Testing

- [x] 5.1 Write tests for dispatch result intake (update with unitId, create without unitId, permission denied for create, invalid type)
- [x] 5.2 Write tests for hub audit notification (success, retry on failure, exhausted retries)
- [x] 5.3 Verify full server builds and starts with dispatch env vars configured
- [x] 5.4 Verify server starts without dispatch env vars (results endpoint returns 503, token session still works)
