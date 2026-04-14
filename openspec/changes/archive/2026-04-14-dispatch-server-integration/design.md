## Context

The Rezics platform has an existing API token system (`package/server/src/token/`) that supports scoped programmatic access, and a session JWT system (`package/server/src/session/jwt/`) that issues short-lived `rezics-session-token` JWTs. An external dispatch ecosystem (CLI + workers) needs to integrate with the main server to: (1) authenticate via API tokens, and (2) submit normalized content data scraped from various source websites.

Currently, API tokens can access user and book endpoints with `user:read/write` and `book:read/write` scopes. Session JWTs are only obtainable via the auth-identity-token exchange flow (`POST /session/exchange`). There is no path for programmatic tools to obtain session JWTs or submit bulk content updates.

## Goals / Non-Goals

**Goals:**
- Enable dispatch CLI to exchange API tokens for session JWTs without going through the auth service
- Accept normalized content results (books, games, media) from workers and upsert into the database
- Gate token→session exchange and result submission behind granular dispatch scopes
- Enforce create vs. update permissions: regular users can only update existing content, admins can create new content
- Relay task completion to the dispatch hub via HMAC-signed audit notifications

**Non-Goals:**
- Worker scheduling or task assignment (handled by the dispatch hub)
- Source-specific data normalization (handled by workers)
- Real-time streaming of results (batch HTTP is sufficient)
- Admin UI for managing dispatch configuration
- Multi-project support (single project `rezics` for now; env vars, not a config table)

## Decisions

### D1: Token session endpoint lives under `/token/session`

The new endpoint follows the existing token route structure in `package/server/src/token/`. It authenticates via `tokenService.authenticateFromHeader()` (same as all `/token/*` routes) and returns a session JWT. This keeps all API-token-authenticated endpoints under the `/token` prefix.

**Alternative considered:** Putting it under `/session/exchange-token` alongside the existing `/session/exchange`. Rejected because the auth mechanism is fundamentally different (API token vs. auth-identity-token) and would require mixing auth strategies in the session module.

### D2: Workers authenticate with API tokens directly, not session JWTs

Both `/token/session` and `/dispatch/results` accept API tokens via `Authorization: Bearer api_xxx`. Workers use the session JWT only when calling other Rezics APIs that expect session auth. The dispatch-specific endpoints use the API token directly because:
- Workers are long-running processes that would need to manage JWT refresh
- API tokens already have scope-based permission checking
- It simplifies the worker implementation

### D3: Single generic results endpoint with `type` discriminant

`POST /dispatch/results` accepts all result types (`rezics:book`, `rezics:game`, `rezics:media`). The `type` field determines which Prisma model to upsert into. The service dispatches internally based on type.

**Alternative considered:** Per-type endpoints (`/dispatch/results/book`, `/dispatch/results/game`). Rejected because it adds route maintenance burden for each new type without meaningful benefit — the type discriminant in the payload is sufficient and keeps the dispatch module simple.

### D4: Data-as-partial-update model (no `kind` discriminant)

Workers submit a partial JSON object whose keys map directly to database fields. The server merges this into the existing record via Prisma's `update()`. For nested relations (e.g., chapters), Prisma's nested writes handle the merge.

There is no `kind` field (metadata, cover, chapters, etc.) — the data shape IS the instruction. If a worker sends `{ title, synopsis }`, only those fields are updated. If it sends `{ chapters: [...] }`, chapters are upserted.

**Alternative considered:** A `kind` discriminant with per-kind processors. Rejected as overengineering — Prisma and PostgreSQL natively support partial JSON updates, and workers already normalize data to match the DB schema.

### D5: Scope structure uses `dispatch` domain with colon-namespaced permissions

```
{ dispatch: ["rezics-server-session", "unit:update", "unit:create"] }
```

- `rezics-server-session` — can exchange API token for session JWT
- `unit:update` — can submit results with `unitId` (update existing content)
- `unit:create` — can submit results without `unitId` (create new content)

This fits the existing `Record<string, string[]>` scope model. The colon namespace (`unit:update`) groups related permissions without needing a deeper structure. Permission checks use the existing `tokenService.hasScope()`.

### D6: Hub audit notification with simple retry

After processing results, the server notifies the dispatch hub via `POST <DISPATCH_HUB_URL>/tasks/audit` with an HMAC-SHA256 signature. The signature is computed over sorted `taskIds + project` using `DISPATCH_RECEIPT_SECRET`.

On failure, the server retries up to 3 times with exponential backoff (1s, 2s, 4s). If all retries fail, the failure is logged and the result is still considered successfully processed — the hub can reassign the task if it doesn't receive the audit.

**Alternative considered:** A persistent retry queue (database-backed). Rejected because the hub has built-in reconciliation (task reassignment), so occasional missed audits are self-healing. The complexity of a queue is not justified.

### D7: New `dispatch/` domain module in server

The dispatch results endpoint gets its own domain module following the existing pattern:

```
package/server/src/dispatch/
├── dispatch.api.ts        ← route definition
├── dispatch.service.ts    ← result processing, hub notification
└── dispatch.types.ts      ← local types (if needed)
```

The token session endpoint is added to the existing `package/server/src/token/token.api.ts` since it shares the same auth mechanism.

## Risks / Trade-offs

**[Risk] Partial updates may produce inconsistent entity state** — A worker could update `title` without updating `synopsis`, leaving stale combinations.
→ Mitigation: Workers are expected to submit coherent updates. The server validates data against Typebox schemas before upserting.

**[Risk] Hub audit notification is best-effort** — If retries exhaust and the hub never learns a task completed, the hub will reassign it.
→ Mitigation: This is acceptable — duplicate processing is idempotent (upserts), and the hub's reassignment is the designed recovery path.

**[Risk] API token with `unit:create` scope could be used to bulk-create content** — A compromised admin token could flood the database.
→ Mitigation: Rate limiting on the dispatch results endpoint (future enhancement). For now, admin token creation is itself gated behind `BasicAdminPermission`.

**[Trade-off] No multi-project support** — Env vars assume a single dispatch project. If multiple projects are needed later, this becomes a config table migration.
→ Accepted: YAGNI. Single project is the foreseeable need.
