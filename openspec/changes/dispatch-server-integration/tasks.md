## 1. Contract — Dispatch Types and Schemas

- [ ] 1.1 Create `package/contract/src/dispatch/` module with `DispatchType` enum (`rezics:book`, `rezics:game`, `rezics:media`) as Typebox literals
- [ ] 1.2 Define `dispatchResultSchema` envelope (taskId, project, type, unitId?, data) in `package/contract/src/dispatch/dispatch.ts`
- [ ] 1.3 Export dispatch scope constants (domain: `"dispatch"`, permissions: `"rezics-server-session"`, `"unit:update"`, `"unit:create"`) in the dispatch contract module
- [ ] 1.4 Re-export dispatch module from `package/contract/src/index.ts`
- [ ] 1.5 Verify contract builds cleanly (`bun run build` or type-check in `package/contract`)

## 2. Server — Token Session Endpoint

- [ ] 2.1 Add `POST /token/session` route in `package/server/src/token/token.api.ts` — authenticate via `tokenService.authenticateFromHeader()`, check `dispatch:rezics-server-session` scope
- [ ] 2.2 Look up token owner's user record (unitId, permission.role) from database
- [ ] 2.3 Call `signRezicsSessionToken({ unitId, role })` and return `{ token }` with status 200
- [ ] 2.4 Handle error cases: 401 (invalid token), 403 (missing scope), 404 (user not found)
- [ ] 2.5 Write tests for the token session endpoint (success, missing scope, invalid token, user not found)

## 3. Server — Dispatch Module Setup

- [ ] 3.1 Create `package/server/src/dispatch/` directory with `dispatch.api.ts`, `dispatch.service.ts`, `dispatch.types.ts`
- [ ] 3.2 Add dispatch environment variables (`DISPATCH_HUB_URL`, `DISPATCH_RECEIPT_SECRET`, `DISPATCH_PROJECT_ID`) to env validation
- [ ] 3.3 Mount `dispatchApi` in `package/server/src/index.ts` via `.use()`

## 4. Server — Result Intake Endpoint

- [ ] 4.1 Implement `POST /dispatch/results` route in `dispatch.api.ts` — authenticate via `tokenService.authenticateFromHeader()`, validate payload against `dispatchResultSchema`
- [ ] 4.2 Implement permission check: require `dispatch:unit:update` scope; if no `unitId`, additionally require `dispatch:unit:create` scope
- [ ] 4.3 Implement result processing in `dispatch.service.ts` — route by `type` to appropriate Prisma upsert logic (book, game, media)
- [ ] 4.4 Implement hub audit notification: HMAC-SHA256 signing of sorted taskIds + project, `POST` to `DISPATCH_HUB_URL/tasks/audit`
- [ ] 4.5 Implement retry logic for hub notification: up to 3 retries with exponential backoff (1s, 2s, 4s), log on exhaustion
- [ ] 4.6 Handle graceful degradation: if dispatch env vars are missing, return 503 from the results endpoint

## 5. Validation and Testing

- [ ] 5.1 Write tests for dispatch result intake (update with unitId, create without unitId, permission denied for create, invalid type)
- [ ] 5.2 Write tests for hub audit notification (success, retry on failure, exhausted retries)
- [ ] 5.3 Verify full server builds and starts with dispatch env vars configured
- [ ] 5.4 Verify server starts without dispatch env vars (results endpoint returns 503, token session still works)
