## Context

The reaction service stores rows shaped `(id, userId, targetId, reaction, createdAt)` with indexes on `(userId, createdAt)` and `(userId, reaction)` — already optimised for "list a user's reactions in reverse-chronological order, optionally filtered by type." But no read API exposes this, and the main server has no profile-scoped reaction route. The frontend tab is a placeholder.

Two query shapes need to be served:

1. **Given.** "List reactions user X has placed." Pure reaction-service query: scan `Reaction` by `userId = X`, paginate by `(createdAt desc, id desc)`, optionally filter by `reaction` type. The reaction service already knows everything it needs.
2. **Received.** "List reactions placed on units owned by user X." This requires knowing which `targetId`s belong to user X — i.e. a join across the unit table (in the main server's database) and the reaction table (in the reaction service's database). The reaction service does not — and per `reaction-auth` design should not — know about Unit ownership.

The placement question (where each route lives) is the central design decision.

## Goals / Non-Goals

**Goals:**

- Provide a working profile Reactions tab with separate Given / Received list views, infinite scroll, and per-row navigation to the target.
- Keep the reaction service free of Unit-ownership knowledge. It exposes only "rows by userId" / "rows by targetId set."
- Pagination uses `(createdAt, id)` cursors — stable under inserts, no offset-based skipping.
- Hydration of human-readable fields (target excerpts, actor display names, avatars) happens on the main server, which already owns those domain objects.

**Non-Goals:**

- Realtime updates on the tab (page refresh / scroll-back fetch is acceptable).
- Filters beyond reaction-type allowlist and the implicit user-id scoping.
- Combined reactions+posts+shelf activity feed.
- Privacy controls beyond existing profile-visibility gating.

## Decisions

### D1. Two surfaces, two owners

`Given` lives on the reaction service as a public route (`GET /reaction/given`). `Received` lives on the **main server** as `GET /profile/:userId/reactions/received`. The main server resolves the user's owned unit-id set via existing user-unit lookups, then calls the reaction service's new internal `POST /internal/by-user` to fetch the corresponding reaction rows, then hydrates actor metadata.

**Rationale.** The reaction service stays a pure data layer over the reaction table — symmetric with how it currently exposes `/summary` (public, by targetId) and `/my` (JWT-gated, by userId from token). Pushing "Received" into the reaction service would require it to either query the main server's unit table (cross-service DB call) or keep a denormalised ownership index (sync drift problem). Neither is worth it for a profile tab.

**Alternative considered.** Push ownership into the reaction service as a `targetUserId` denormalised column populated at create time. Rejected: requires the main server to send `targetUserId` on every create call, schema migration, and a backfill — for one feature.

### D2. Pagination shape

All list routes use opaque cursors: a base64-encoded `{ createdAt, id }` pair. The server returns `{ items, nextCursor }`. `nextCursor` is `null` when no more pages. The client passes `cursor` directly back. Page size: server-enforced default 20, max 50.

**Rationale.** Reverse-chronological with stable tiebreaker on `id` survives concurrent inserts and deletes. Offset pagination drifts; opaque cursor is the standard fix.

### D3. `Received` returns rows joined with `actor`, not aggregated

Each row in `Received` represents a single reaction event ("user A liked your review B at time T"). The view does not aggregate ("3 people liked your review B"). Forum convention varies, but Reddit's `/u/.../upvoted` and HN's profile activity both list individual events; aggregation belongs in a notification feed (`reaction-notification` already covers this). Two surfaces, two purposes.

### D4. Privacy is enforced at the main-server layer

`/reaction/given` (reaction service direct) is unauthenticated and returns rows for any `userId` that has reactions. Privacy enforcement (private profiles, blocks, etc.) happens in the **main server's** `/profile/:userId/reactions/given` endpoint, which proxies to the reaction service after checking visibility. Frontend ALWAYS goes through the main server's profile-scoped routes for both Given and Received — never directly to `/reaction/given`. The reaction-service public route exists for symmetry / debug / future internal callers; the rate-limit and visibility surface is the main server.

**Rationale.** The reaction service has no concept of "private profile." Layering privacy on the main server keeps the data-layer service simple. If the same approach is good enough for `/reaction/summary` (public counts on any target), it is good enough here.

### D5. `Received` joins on owned units, not on a separate "mentions" table

The main server resolves ownership via `prisma.unit.findMany({ where: { userId: profileUserId }, select: { id: true } })`. For users with thousands of units, the resolver collects ids and pages them — but the typical case is hundreds. The join is in-memory: the server pages through reaction-service results filtered by the resolved id set.

**Trade-off.** A power user owning 50k units will not have all id-collisions checked in one call. Acceptable: the cursor pagination handles iteration; we just send a chunked id set per call (e.g. up to 1000 ids; if the user owns more, we stream through ownership pages).

**Better alternative for the future.** Once we have a sustained power-user case, denormalise `targetUserId` into the reaction table and lift `Received` into a direct reaction-service query. Out of scope here.

### D6. Frontend uses TanStack Query infinite queries

`useGivenReactionsInfinite(userId, options)` and `useReceivedReactionsInfinite(userId, options)` use `useInfiniteQuery` with `getNextPageParam` reading `nextCursor` from the response. The list scrolls; the chip switch resets the active query.

### D7. Row component is shared

A single `ReactionHistoryItem` component renders both Given and Received rows. Mode is determined by a `mode: "given" | "received"` prop:

- `given`: shows reaction icon + target snippet + timestamp; navigates to target detail.
- `received`: shows actor avatar/name + reaction icon + target snippet + timestamp; navigates to target detail; actor avatar links to actor profile.

**Rationale.** Same domain object (a reaction event), two perspectives. Sharing the row keeps spacing/typography consistent and avoids two near-identical components.

### D8. Filter chips drive the tab, not the URL (initially)

The Given/Received chip is local state (or a search-param if cheap). Reaction-type filters (all / like / dislike) are reserved as a future enhancement; not in this change.

## Risks / Trade-offs

- **[Privacy enforcement at main server but reaction service public endpoint exposes raw rows.]** → Mitigation: document explicitly that `/reaction/given` is intended for server-to-server / debug usage, not direct frontend consumption. Add a clear comment at the route handler. Rate-limit at gateway level. If genuine privacy is required for a deployment, gate the route behind internal-secret as a follow-up.
- **[Power-user ownership set is too large for in-memory join.]** → Mitigation: pageable. Long-term, denormalise (D5).
- **[Cursor encoding bugs cause infinite loop or stuck pagination.]** → Mitigation: spec test that exercises both empty page (`nextCursor: null`) and mid-page (`nextCursor` decodes back to the last row's `(createdAt, id)`).
- **[Hydration cost on the main server (joining unit metadata + actor metadata for 20 rows per page).]** → Mitigation: existing user/unit batch-resolution helpers are fast enough for 20-50 rows; if needed, the spec allows the response to defer some metadata to a follow-up call.
- **[`Received` count of "all units owned" returns realm/book/post types but the tab UI is heterogeneous.]** → Mitigation: tab renders rows by content kind. The `target` payload carries `kind` so the row knows what to display. Out-of-the-box kinds: `post`, `review`, `remark`, `excerpt`, `shelf`, `realm`, `book`. Future kinds slot in by extending the discriminator.

## Migration Plan

1. **Reaction service**: add `GET /reaction/given` + `POST /internal/by-user` + supporting service methods. Land independently; no callers yet.
2. **Contract**: add the new schemas under `package/contract/src/reaction/`.
3. **Main server**: add `/profile/:userId/reactions/{given,received}` routes; wire owned-unit resolver and reaction-service client calls; hydrate actor + target metadata.
4. **Frontend hooks**: add `useGivenReactionsInfinite` + `useReceivedReactionsInfinite` in `package/api/src/reaction/`.
5. **Frontend section**: rewrite `ReactionsTabSection` from placeholder to real. Enable the chips.
6. **Validation**: per-package `tsc --noEmit`, convention check, manual end-to-end on a seeded user.

Rollback: route additions are additive; reverting them removes the tab feature without breaking existing behaviour. The `ReactionsTabSection` revert restores the placeholder.

## Open Questions

- **Q1.** Should the main server's `received` endpoint hide reactions where the actor is the profile owner (self-reactions)? Default yes — it's noise — but worth confirming.
- **Q2.** When a Unit is deleted, the reaction service cleans up its rows (via existing `/internal/cleanup`). The historical "X liked your review B" entries vanish. Acceptable, or do we want soft-delete for activity-feed history? Decision: acceptable, matches forum norms (deleted-content lists do not show).
- **Q3.** `reactions=` filter parameter accepts a comma-separated allowlist. Should the default be "all configured types" or only "like,dislike"? Decision: all configured types so the tab automatically reflects future reaction types without code changes.
