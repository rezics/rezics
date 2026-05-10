## Why

The profile Reactions tab today is a pure placeholder — `package/app/src/user/sections/ReactionsTabSection.tsx` shows "Reaction history is coming soon" with two `disabled: true` chips. The reaction service has the data (the `Reaction` table is indexed on `(userId, createdAt)` and `(userId, reaction)`, anticipating exactly this list), but it does not expose endpoints to query a user's reaction history, and the frontend has no list shell, no pagination, no item rendering. For "real forum" parity (Reddit's `/u/<name>/upvoted`, `/u/<name>/downvoted`; HackerNews's profile lists; Lobsters's saved/voted streams), this tab needs to actually work. This change builds it end-to-end.

## What Changes

- **NEW** Reaction service public route `GET /reaction/given?userId=<u>&reactions=<types>&cursor=<c>&limit=<n>` — returns the user's own reactions in reverse-chronological order. `reactions` is an optional comma-separated allowlist filter (default: all types). Cursor pagination on `(createdAt, id)`. Rate-limited but unauthenticated for public profiles; private profiles fall under existing profile-visibility rules and SHALL be enforced by the main server, not the reaction service (see design).
- **NEW** Reaction service public route `GET /reaction/received?userId=<u>&reactions=<types>&cursor=<c>&limit=<n>` — returns reactions other users have placed on units owned by `userId`. Implementation requires the reaction service to know unit ownership; rather than denormalising it, the **main server** owns this route as `/profile/<userId>/reactions/received` and queries the reaction service via internal API for raw rows once it has resolved the user's owned `unitId` set.
- **NEW** Reaction service internal route `POST /internal/by-user` (shared-secret) — returns paged reaction rows for a list of `targetIds` filtered by `userId IS NOT actorId`-style criteria. Used by the main server's `received` endpoint to satisfy the join.
- **NEW** Main server endpoint `GET /profile/:userId/reactions/given` — proxies the reaction-service `given` endpoint, plus optionally hydrates target `unit` summaries (title, content kind, slug) for rendering. Auth: read public profiles freely; private profiles 403.
- **NEW** Main server endpoint `GET /profile/:userId/reactions/received` — resolves the user's owned units, calls reaction service `/internal/by-user`, hydrates actor summaries (display name, avatar) and target units. Auth: same.
- **NEW** Frontend `useGivenReactionsInfinite` and `useReceivedReactionsInfinite` query hooks (cursor-paginated TanStack Query infinite queries).
- **NEW** Frontend `ReactionsTabSection` real implementation: enables the existing `Given` / `Received` chips, switches between two list views, renders a `ReactionHistoryItem` row per entry. The row shows the actor (Received) or target (Given), the reaction emoji/icon, the target excerpt, the timestamp, and a `<SafeLink>` to the target's detail page.
- **CHANGED** `package/app/src/routes/_mainLayout/user/$userId/reactions.tsx` route component lazy-loads the new `ReactionsTabSection`.
- **CHANGED** `profile-reactions-tab` capability spec — drops "placeholder + disabled chips" requirements; replaces with the real-tab requirements.

## Capabilities

### New Capabilities

- `reaction-history`: Reaction service + main-server contracts for paginated reaction history queries (Given / Received), backed by the existing `Reaction` table indexes. Defines pagination shape, filter parameters, and hydration responsibilities split between the two services.

### Modified Capabilities

- `profile-reactions-tab`: replaces the placeholder + disabled-chips requirements with real Given/Received list views, infinite scroll, and per-row rendering.
- `reaction-internal-api`: adds `POST /internal/by-user` for the main server to fetch reaction rows scoped to a target id list.

## Impact

**Affected packages**

- `package/reaction/` — new public routes (`/reaction/given`, `/reaction/received` if we decide it lives there; see design), new internal route (`/internal/by-user`), supporting service methods, contract types in `package/contract/src/reaction/`.
- `package/server/` — new main-server routes under `/profile/:userId/reactions/{given,received}`, owned-unit lookup, hydration of target/actor metadata, public/private profile gating.
- `package/contract/src/reaction/` — schema additions for the new endpoints and pagination cursor shape.
- `package/api/src/reaction/` — new `useGivenReactionsInfinite` / `useReceivedReactionsInfinite` hooks.
- `package/app/src/user/sections/ReactionsTabSection.tsx` — full rewrite from placeholder to real implementation. New `ReactionHistoryItem` component; inner filter panel re-enabled.
- `package/app/src/routes/_mainLayout/user/$userId/reactions.tsx` — unchanged structurally but lazy-import target rewrites.

**Cross-cutting**

- The `received` endpoint requires resolving "all units owned by this user" then fetching reactions on those targets. Existing user-units mechanisms (see `UserUnitsPage`) already enumerate this set; reuse the underlying service rather than duplicating the query.
- Rate limiting on the reaction service's public endpoints is the responsibility of whatever gateway/middleware already protects `/reaction/summary` — this change does not introduce a new rate-limit framework.
- Privacy: who can view someone else's reactions is a profile-scope decision, not a reaction-scope decision. The reaction service trusts the main server's gating and exposes data unconditionally on its public endpoints (consistent with how `/reaction/summary` is public). The main server enforces "is this profile public + does the viewer have permission".

**Backward compatibility**

- Development-stage cutover. The placeholder section is replaced; the existing `disabled: true` chips become live. Per `CLAUDE.md`, no compatibility shim.
- The new reaction-service routes are additive; existing `/reaction/summary`, `/reaction/my`, and the internal create/remove/cleanup are unchanged.

**Out of scope**

- Profile activity feed combining reactions, posts, comments, and shelf actions. This change owns only the Reactions tab.
- Filters by reaction type beyond the existing allowlist (`like`, `dislike`). Future reaction types arrive via `engagement-reaction-bar` and `reaction-crud` and are automatically supported by the comma-separated `reactions=` parameter.
- Soft-delete or hide controls for received reactions (e.g. block a user). Out of scope.
- Sorting controls beyond reverse-chronological default. Out of scope.
