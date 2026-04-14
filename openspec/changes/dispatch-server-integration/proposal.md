## Why

The Rezics platform needs to support an external dispatch CLI and worker ecosystem that scrapes, normalizes, and submits content data (books, games, media) from various source websites. The main server must provide two integration points: (1) a way for CLI tools to exchange long-lived API tokens for short-lived session JWTs, and (2) an endpoint to receive normalized task results from workers and relay completion audits to the dispatch hub.

## What Changes

- **New `POST /token/session` endpoint** — Exchanges an API token for a short-lived `rezics-session-token` JWT. This is the auth path for the dispatch CLI: users create API tokens via the web UI and the CLI exchanges them for JWTs on demand.
- **New `POST /dispatch/results` endpoint** — Receives normalized task result data from workers, upserts content into the database via Prisma, and notifies the dispatch hub via HMAC-signed audit requests.
- **New `dispatch` scope domain for API tokens** — Granular permissions: `rezics-server-session` (mint JWTs), `unit:update` (submit results with existing unitId), `unit:create` (submit results without unitId, creating new content). Regular users can only update; admins can also create.
- **New dispatch type contract** — Defines `rezics:book`, `rezics:game`, `rezics:media` as dispatch result types in `@rezics/contract`, with normalized data schemas per type.
- **New environment variables** — `DISPATCH_HUB_URL`, `DISPATCH_RECEIPT_SECRET`, `DISPATCH_PROJECT_ID` for hub communication.

## Capabilities

### New Capabilities

- `dispatch-token-session`: API token → session JWT exchange endpoint with scope-gated access
- `dispatch-result-intake`: Worker result submission endpoint with type-based upsert and hub audit notification
- `dispatch-contract`: Shared dispatch types, result envelope schema, and per-domain data schemas in `@rezics/contract`

### Modified Capabilities

- `server-access-token`: Adding `dispatch` scope domain with `rezics-server-session`, `unit:update`, `unit:create` permissions

## Impact

- **Affected packages:** `@rezics/server` (new routes + service), `@rezics/contract` (new dispatch types + scope additions)
- **APIs:** Two new HTTP endpoints; no changes to existing endpoints
- **Dependencies:** No new runtime dependencies; uses existing Prisma, JWT signing, and HTTP client
- **Systems:** Requires network access from main server to dispatch hub for audit notifications
- **Backward compatibility:** Fully additive — no breaking changes to existing API tokens or endpoints. Existing tokens without `dispatch` scope are unaffected.
