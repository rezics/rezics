## Context

Four pre-existing inconsistencies in the auth/identity layer have accumulated:

1. **Misnamed PK.** `User.unitId` is the primary key but `User` is not a `Unit` subtype; there is no FK from `User.unitId` to `Unit.id`. The original design treats `User` as independent first-class content with its own `slug`, distinct from `Unit` (which is the multi-language/realm-scoped content node). Naming has leaked into ~115 server files and ~555 frontend references.
2. **Redundant readiness flag.** `User.accountStatus` (`PROFILE_SETUP_REQUIRED` | `MEMBER_READY`) duplicates `slug !== null`. The two are written together in `materializeFromVerifiedAuth` (slug=null + PROFILE_SETUP_REQUIRED) and `completeProfileSetup` (slug=set + MEMBER_READY). The two states are 1:1.
3. **Dead JWT-header pathway.** `POST /session/exchange` (consuming `x-auth-session-token` JWT in a header, verified via the `auth-upstream` JWKS service) has zero callers in `package/api`, `package/auth`, or any monorepo consumer. The cookie-based `/auth/session/refresh` already covers all browser flows; API tokens use `/token/session`. The pathway is the residue of a "stateless JWT in header" era that was superseded by httpOnly cookies for browser sessions.
4. **Asymmetric seed.** `crossSeedUser` interleaves auth+main per user, so a partial failure mid-loop leaves a half-seeded universe. The factory mock seeder (`package/server/prisma/factory/users.ts`) creates server users with no corresponding auth row — those mock users cannot log in and silently fail any auth-touching code path during dev/demo.

The four are entangled: a clean cutover for any one of them touches the same files as the others (schema, contract `token.ts`, frontend `jwt.ts`, seed). Splitting the work creates intermediate states where the schema has moved but the contract or frontend has not.

**Constraints:**
- Per project CLAUDE.md "Development-Stage Compatibility": no compatibility aliases, dual-read shims, or legacy field re-exports for internal renames.
- Single Prisma migration per database (only the server DB changes; auth DB is untouched).
- Token transport boundaries are already specified by the `unified-access-token` and `server-access-token` capabilities — this change tightens (not loosens) what those capabilities require.

## Goals / Non-Goals

**Goals:**
- One Prisma migration that renames `User.unitId` → `User.userId`, drops `accountStatus` + the `UserAccountStatus` enum + the index, and updates FK target columns on `Unit`, `WorkLinkClaim`, `UserUnitProgress`, `Follow`, `ApiToken`, etc.
- Delete every artefact of the JWT-in-header session pathway across `server`, `auth`, `contract`, and `api` packages — endpoints, schemas, exports, CORS allowed-headers, env vars, frontend storage helpers — in the same change.
- Replace all `accountStatus` reads with `slug !== null` semantics and delete the column.
- Restructure seed: phase 1 seeds all auth users; phase 2 seeds all main users using a captured `{email → authUserId}` map. The factory mock seeder cross-seeds an auth user for every mock user it produces.
- Land all internal call-site updates (~115 server files, ~555 frontend references) in the same change so no commit ever has a half-renamed schema.

**Non-Goals:**
- Strict-typing `User.permission` JSON column (tracked under `typed-json-fields`).
- Restructuring the two-cookie split (`rezics-session-token` vs `rezics-profile-setup-token`) — the split grants distinct scopes and is intentional.
- Touching API-token (`api_*` Bearer) flows under `/token/*` and `/dispatch/*`.
- Renaming `Unit.userId` (the field is already correctly named; only its `references: [...]` target changes).
- Production data migration plans — repo is in active development.

## Decisions

### D1 — Single big change vs. four sequential changes

**Decision:** Land all four cleanups as one OpenSpec change with one Prisma migration.

**Rationale:** The four overlap on the same files. A staged approach would require:
- (a) renaming `unitId → userId` while contract still emits `unitId` — frontend type errors everywhere; or
- (b) dropping `accountStatus` while `auth-boundary.service.ts` still reads it — runtime errors; or
- (c) deleting `/session/exchange` after rename but before contract cleanup — orphaned `NormalizedTokenName.AUTH_SESSION` enum entries.

Each interim state requires its own compatibility shim, which CLAUDE.md prohibits. Staging by package is also pointless because the contract package fans out to every package — touching `token.ts` or `user.ts` re-implicates everything.

**Alternative considered:** Four separate changes with feature flags. Rejected — feature flags are explicitly out of scope per "Development-Stage Compatibility".

### D2 — `slug !== null` as the readiness predicate

**Decision:** Drop `accountStatus`. Use `slug !== null` everywhere readiness is checked. `User.slug` becomes `String? @unique` (already nullable; semantics codified).

**Rationale:** Today, the only writers of `accountStatus` are `materializeFromVerifiedAuth` (PROFILE_SETUP_REQUIRED + slug=null) and `completeProfileSetup` (MEMBER_READY + slug=canonical). The two columns move in lockstep. `slug !== null` carries strictly more information (the actual slug, not just the boolean), and the cookie split (`rezics-profile-setup-token` vs `rezics-session-token`) already enforces route-level access — a profile-setup user cannot reach session-required routes regardless of any DB flag.

**Alternative considered:** Keep `accountStatus` as a defensive cross-check. Rejected — duplicate state is a recurring bug source (the two columns can drift), and the user explicitly framed the redundancy: routes are gated by token, not by DB flag.

**Implication for `meili/user/sync.ts`:** Change `if (user.accountStatus !== "MEMBER_READY" || !user.name || !user.slug) return;` to `if (!user.name || !user.slug) return;` — equivalent because slug presence is the readiness signal.

### D3 — Endpoint deletion vs. tombstone

**Decision:** Delete `POST /session/exchange` and `POST /session/jwks` (the latter is already covered by `/.well-known/jwks.json`). No 410 Gone tombstone.

**Rationale:** Confirmed zero callers via grep across `package/api`, `package/auth`, every monorepo consumer, and committed test fixtures. The exchange path was the residue of a legacy "JWT in header" era; the user explicitly stated no monorepo-external callers exist. A tombstone would just preserve a route that no client knows about.

**Alternative considered:** Return 410 from `/session/exchange` and keep the route shell. Rejected — the route shell pulls in `getJwtService("auth-upstream")`, the `auth-upstream` bootstrap, `verifyAuth`, etc. Deleting only the body still drags the whole subsystem.

### D4 — Cascading deletes in the JWT-header subsystem

**Decision:** When deleting `/session/exchange`, also delete every consumer-less symbol it kept alive:
- Server: `getJwtService("auth-upstream")` bootstrap (`package/server/src/index.ts`), `package/server/src/user/utils/index.ts` (the entire file), `x-auth-session-token` from CORS `allowedHeaders`.
- Auth: `verifyAuth` and `verifyAuthSessionToken` exports from `@rezics/auth` (only consumer was server's `user/utils/index.ts`), `x-auth-session-token` from CORS, `env.SERVER_BASE_URL` (declared but unreferenced).
- Contract: `NormalizedTokenName.AUTH_SESSION`, `TokenTransportHeader.AUTH_SESSION_EXCHANGE`, `AuthSessionTokenClaims` schema, the corresponding `normalizedTokenHeaderMap` / `normalizedTokenTransportMap` / `TokenContextKey` entries.
- API: `tokenStrategy.storeKeyByToken` machinery, `getToken` / `setToken` / `removeToken` / `writeAuthSnapshot` / `readStoredToken` / `isAuthenticated`, `AUTH_TOKEN_STORAGE_EVENT`. `exchangeForSessionToken()` keeps its name but its body becomes a thin wrapper around `/auth/session/refresh` (the only thing it ever actually does post-cleanup).
- JWT: `package/jwt/adapter/jose-verifier.ts` defaults `NormalizedTokenName.AUTH_SESSION` everywhere — re-point defaults to `REZICS_SESSION` (or make the parameter required where re-pointing is wrong).

**Rationale:** Once the entry point is gone, every transitive symbol becomes dead weight. Leaving any one of them invites future "what is this?" archaeology.

### D5 — Redundant `role` claim in `RezicsSessionClaims`

**Decision:** Remove the top-level `role` claim from `RezicsSessionClaims`; keep `permission.role` as the single source of role information.

**Rationale:** `permission` is a JSONB column whose canonical shape includes `role`. The top-level `role` was added during the JWT-header era to keep the claim flat. With the cookie path, all consumers already read `permission.role`. Two locations for the same fact is bug-prone; pick one.

**Migration risk:** Any consumer that decodes `claims.role` directly (not via `claims.permission.role`) would break. Sweep: `rg "claims\.role|sessionClaims\.role" package/`.

### D6 — `claims.unitId || claims.sub` fallback dies with the endpoint

**Decision:** No standalone migration for the JWT claim shape — it's coupled to D3.

**Rationale:** The fallback was inside `/session/exchange`. Once the endpoint is deleted, the claim no longer needs to support both shapes. The remaining issuers (`signRezicsSessionToken`, `signRezicsProfileSetupToken`) already use `userId`; consumers (cookie-path verifiers in `auth-boundary.service.ts`) read `claims.userId` (post-rename) or `claims.sub` per JWT convention.

### D7 — Two-phase seed with captured ID map

**Decision:**
- Split `seedAllUsers()` into `seedAllAuthUsers()` (phase 1) and `seedAllMainUsers(authResults)` (phase 2). Phase 2 receives the `{email → authUserId, name, slug}` results from phase 1.
- Factory mock seeding (`package/server/prisma/factory/users.ts`): for every mock user, call `seedAuthUser` first, then `prisma.user.create({ data: { userId: authResult.userId, authUserId: authResult.userId, ... } })`. The factory orchestrator threads `authPrisma` through `SeedCtx`.
- `resetDatabase` resets both auth and server DBs (currently only server).

**Rationale:** A partial failure in phase 1 leaves the auth DB in a known intermediate state; phase 2 can be re-run idempotently (upsert by email/userId) once phase 1 succeeds. Mock users cross-seeded into auth become indistinguishable from real users for dev/demo flows that exercise login.

**Alternative considered:** Single transaction wrapping both DBs. Rejected — Prisma cannot transact across two databases. The two-phase ordering with idempotent upserts is the closest equivalent.

### D8 — Naming sweep strategy

**Decision:** Rename `unitId → userId` is performed mechanically (rg + sd) per package, then each package's `bun run check` is run in isolation. Frontend `user.unitId` accesses (~555) are mostly mechanical replacements at the DTO consumer level once the contract `User` schema renames its field.

**Rationale:** The rename is large but local — every site reads `user.unitId` from a typed source (Prisma client output, contract-typed DTO, or `User`-shaped variable). TypeScript surfaces every miss after the schema change. No runtime fallback is needed.

**Order:**
1. Schema + Prisma migration (rename column).
2. `package/contract` rename (DTO field).
3. `package/server` rename (queries, mappers, service args, middleware fn args).
4. `package/api` consumers.
5. `package/app`, `package/admin`, `package/ui`, etc.
6. Tests.

Each step compiles in isolation given (1) and (2) cascade through type-checking.

## Risks / Trade-offs

- **[Risk]** A non-listed monorepo consumer reads `claims.role` (top-level) directly. → **Mitigation:** Final grep before merge: `rg "claims?\.role[^.]" --type=ts package/` and inspect every match. If any survive, route through `claims.permission.role`.

- **[Risk]** A test fixture writes `accountStatus` via `prisma.user.create({ data: { accountStatus: ... } })`. → **Mitigation:** `rg "accountStatus" --type=ts package/` will surface every site; delete the field write.

- **[Risk]** A consumer of `package/jwt` relies on the default `NormalizedTokenName.AUTH_SESSION` in `jose-verifier.ts`. → **Mitigation:** D4 re-points the default. Verify by `rg "joseVerifier|JoseVerifier" package/` and confirm explicit token-name args at every callsite.

- **[Risk]** Frontend code path that handled `accountStatus === "PROFILE_SETUP_REQUIRED"` server-side is replaced by client-side `slug === null` check, but the client doesn't always have `slug` populated. → **Mitigation:** The user DTO returned to the client always includes `slug` (verified — `slug` is part of the shared `User` contract). Profile-setup gating remains driven by the `rezics-profile-setup-token` cookie, not by client-side computation.

- **[Risk]** Mock factory cross-seeding doubles the seed time (each mock user now writes to two DBs). → **Trade-off:** Acceptable. Realistic preset has ~50–100 mock users. Auth writes are fast; seed is a dev-only pipeline.

- **[Risk]** The Prisma migration renames a primary key column in place. If any database has uncommitted concurrent writes, rename can serialize. → **Mitigation:** Repo is dev-stage; the migration runs against an empty/dev DB. Production migration strategy is out of scope.

- **[Risk]** Renaming `unitId → userId` in ~555 frontend sites is mostly mechanical, but a few sites pass `unitId` as a free string into a generic helper (e.g., a hook that takes `{ id: string }`). → **Mitigation:** TypeScript catches every typed access. Any remaining usage of the literal string `"unitId"` (e.g., as a query-key segment) is found via `rg "unitId"` post-rename and reviewed individually.

- **[Trade-off]** No tombstone for `/session/exchange` means any external monorepo client that still uses it will receive 404 instead of 410. → **Acceptable** — confirmed zero external callers.

## Migration Plan

1. **Schema migration (server DB only).** One Prisma migration:
   - Rename `User.unitId` → `User.userId` (PK).
   - Drop `User.accountStatus` column, drop `UserAccountStatus` enum, drop `@@index([accountStatus])`.
   - Update FK references on `Unit.userId`, `WorkLinkClaim.claimerUserId/resolvedBy`, `UserUnitProgress.userId`, `Follow.followerId/followingId`, `ApiToken.userId` to point at `User.userId`. (FK column names on these tables already use `userId`-style — only the `references: [...]` target changes.)
2. **Contract.** Rename DTO field `unitId → userId` on `User`-shaped contracts. Delete `NormalizedTokenName.AUTH_SESSION`, `TokenTransportHeader.AUTH_SESSION_EXCHANGE`, `AuthSessionTokenClaims`, related map entries. Drop top-level `role` from `RezicsSessionClaims`.
3. **Server.** Sweep `unitId` → `userId` in queries, services, middleware, mappers, cache keys. Delete `/session/exchange`, `/session/jwks`, `auth-upstream` bootstrap, `user/utils/index.ts`, CORS `x-auth-session-token`. Replace `accountStatus` checks with slug checks.
4. **Auth.** Delete `verifyAuth`, `verifyAuthSessionToken` exports, CORS `x-auth-session-token`, `env.SERVER_BASE_URL`.
5. **API.** Slim `react-query/jwt.ts`: keep `exchangeForSessionToken()` as a thin `/auth/session/refresh` wrapper, delete the rest of the legacy storage/event machinery.
6. **App / Admin / UI / app-shell / search.** Mechanical `user.unitId` → `user.userId` rename.
7. **Seed.** Two-phase split. Factory cross-seed.
8. **Tests.** Delete `session.api.test.ts` exchange tests; update `auth-boundary/*.test.ts`, `middleware/permission.test.ts`, `user/api/*.test.ts`, `factory/presets.test.ts`. Add: factory mock user can complete a sign-in round-trip; `slug !== null` is the readiness gate.
9. **Verification.** Run `bun test` per package, `bun run check:convention`, `bun run knip` to catch newly-orphaned exports.

**Rollback:** Per-step git revert. The schema migration is the only step that requires explicit DB rollback (`prisma migrate reset` in dev).

## Open Questions

- **Q1.** `package/notify` and `package/reaction` import `NormalizedTokenName.REZICS_SESSION` — confirm they don't transitively re-export `AUTH_SESSION`. *Resolution path:* `rg "AUTH_SESSION" package/notify package/reaction` during apply.
- **Q2.** Are there any consumers of `package/jwt`'s `joseVerifier` that pass no `tokenName` argument and rely on the `AUTH_SESSION` default? *Resolution path:* grep + inspection during D4 sweep.
- **Q3.** Does `resetDatabase` currently have an auth-side equivalent that should be promoted to the orchestrator, or does it need to be written? *Resolution path:* check `package/utils/src/seed/index.ts` and `package/auth/prisma/seed/`.
