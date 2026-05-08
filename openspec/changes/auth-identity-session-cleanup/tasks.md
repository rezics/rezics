## 1. Schema migration (server DB)

- [ ] 1.1 Edit `package/server/prisma/schema.prisma`: rename `User.unitId` → `User.userId`; drop `accountStatus` field; drop `UserAccountStatus` enum; drop `@@index([accountStatus])`.
- [ ] 1.2 Update FK `references: [...]` targets on `Unit.userId`, `WorkLinkClaim.claimerUserId`, `WorkLinkClaim.resolvedBy`, `UserUnitProgress.userId`, `Follow.followerId`, `Follow.followingId`, `ApiToken.userId`, and any other `User`-referencing relations to `User.userId`.
- [ ] 1.3 Run `cd package/server && bun run prisma:migrate` to generate one migration capturing the rename + drops; commit the generated SQL.
- [ ] 1.4 Run `cd package/server && bun run prisma:generate` and verify the regenerated client emits `userId` on `User`.
- [ ] 1.5 Confirm `package/auth/prisma/schema.prisma` is untouched.

## 2. Contract package (`@rezics/contract`)

- [ ] 2.1 In `package/contract/src/token.ts`: delete `NormalizedTokenName.AUTH_SESSION`, `TokenTransportHeader.AUTH_SESSION_EXCHANGE`, `AuthSessionTokenClaims` schema, and corresponding entries in `normalizedTokenHeaderMap`, `normalizedTokenTransportMap`, and `TokenContextKey`.
- [ ] 2.2 Drop the top-level `role` claim from `RezicsSessionClaims`; keep only `permission: { role }`.
- [ ] 2.3 Rename DTO field `unitId` → `userId` on every user-shaped contract (`User`, `UserBrief`, `UserSummary`, profile responses, slug-availability response, etc.) in `package/contract/src/user.ts` and any companion files.
- [ ] 2.4 Drop any `accountStatus` field from user-shaped contracts and remove a `UserAccountStatus`-mirror enum if defined in contract.
- [ ] 2.5 Run `cd package/contract && bun run build` (or `tsc --noEmit`) to confirm the package type-checks.

## 3. Auth package (`@rezics/auth`) cleanup

- [ ] 3.1 Delete `verifyAuth` and `verifyAuthSessionToken` exports from `package/auth/src/session/jwt/verify.ts` (and remove the file or strip it down if no other exports remain).
- [ ] 3.2 Remove `"x-auth-session-token"` from `allowedHeaders` in `package/auth/src/index.ts`.
- [ ] 3.3 In `package/auth/src/env.ts`, remove the unused `SERVER_BASE_URL` declaration.
- [ ] 3.4 Search `package/auth/` for any remaining references to `auth-session-token` JWT-header concepts; remove if dead.
- [ ] 3.5 Run `cd package/auth && bun run prisma:generate && tsc --noEmit && bun test` to confirm.

## 4. Server package (`@rezics/server`) — JWT-header pathway deletion

- [ ] 4.1 Delete the `POST /session/exchange` route and its handler in `package/server/src/session/session.api.ts`.
- [ ] 4.2 Delete the deprecated `POST /session/jwks` route in the same file (covered by `/.well-known/jwks.json`).
- [ ] 4.3 Delete `package/server/src/user/utils/index.ts` entirely (`buildTrustedAuthVerifyOptions`, `buildAuthVerifyOptions`, `verifyAuthToken`).
- [ ] 4.4 Remove the `getJwtService("auth-upstream")` bootstrap and its registration in `package/server/src/index.ts`; re-point any `joseVerifier` defaults if they relied on `NormalizedTokenName.AUTH_SESSION` (see task 8.1).
- [ ] 4.5 Remove `"x-auth-session-token"` from `allowedHeaders` in the server's CORS configuration in `package/server/src/index.ts`.
- [ ] 4.6 Delete `package/server/src/session/session.api.test.ts` exchange tests (or strip the file to its surviving tests).

## 5. Server package — `unitId` → `userId` rename

- [ ] 5.1 Rename every `where: { unitId: ... }` clause on the `User` model to `where: { userId: ... }` across `package/server/src/`.
- [ ] 5.2 Rename `unitId` to `userId` in user mappers (`package/server/src/user/models/mapper.ts`), service args (`package/server/src/user/service/*`), and middleware function args (`verifyAdminFromDb`, `verifyRootFromDb` in `package/server/src/middleware/permission.ts`).
- [ ] 5.3 Update `package/server/src/meili/user/sync.ts` to read `user.userId`; replace `user.accountStatus !== "MEMBER_READY"` with `!user.slug` (see task 6.1).
- [ ] 5.4 Update auth-boundary service (`package/server/src/auth-boundary/auth-boundary.service.ts`) to operate on `userId` and to derive readiness from `slug !== null` (see task 6).
- [ ] 5.5 Update the cache or lookup helpers that previously referenced `unitId` on `User` to use `userId`.
- [ ] 5.6 Verify with `rg "user(?:\.|\[\")unitId" package/server/src/` returning empty results.

## 6. Server package — `accountStatus` removal

- [ ] 6.1 Replace every read of `user.accountStatus` with the equivalent slug-presence check (`!user.slug` for "not ready", `user.slug != null` for "ready"). Audit `auth-boundary.service.ts`, `meili/user/sync.ts`, and any other consumer.
- [ ] 6.2 Remove `accountStatus: "PROFILE_SETUP_REQUIRED"` from `materializeFromVerifiedAuth` in `package/server/src/user/service/user.service.ts`.
- [ ] 6.3 Remove `accountStatus: "MEMBER_READY"` from `completeProfileSetup` in the same file.
- [ ] 6.4 Search server source for any remaining `accountStatus` reference and remove (`rg "accountStatus" package/server/src/`).
- [ ] 6.5 Update the cookie-boundary refresh handler so `refreshMainSessionFromAuth` returns the profile-setup-required response when `slug === null`, instead of when `accountStatus === "PROFILE_SETUP_REQUIRED"`.

## 7. Server JWT signing & claim consumption

- [ ] 7.1 Verify `signRezicsSessionToken` in `package/server/src/session/jwt/jwt.service.ts` accepts `userId` and writes `{ sub: userId, userId, permission: { role } }` — drop any top-level `role` claim and any `unitId` claim.
- [ ] 7.2 Verify `signRezicsProfileSetupToken` similarly emits `userId`-shaped claims.
- [ ] 7.3 Delete the `claims.unitId || claims.sub` fallback (it lived inside `/session/exchange`; should be deleted with task 4.1).
- [ ] 7.4 Update consumers that read `claims.role` to read `claims.permission.role`. Sweep with `rg "claims?\.role[^.]" --type=ts package/`.

## 8. Shared JWT package (`@rezics/jwt`)

- [ ] 8.1 In `package/jwt/src/adapter/jose-verifier.ts`, re-point default `NormalizedTokenName.AUTH_SESSION` references to `NormalizedTokenName.REZICS_SESSION` (or make the parameter required where re-pointing is wrong).
- [ ] 8.2 Sweep `package/jwt/` for any other `AUTH_SESSION` literal; remove or re-point.
- [ ] 8.3 Run `cd package/jwt && tsc --noEmit && bun test`.

## 9. API frontend package (`@rezics/api`)

- [ ] 9.1 In `package/api/src/react-query/jwt.ts`: delete `tokenStrategy.storeKeyByToken` machinery, `getToken`, `setToken`, `removeToken`, `writeAuthSnapshot`, `readStoredToken`, `isAuthenticated`, and `AUTH_TOKEN_STORAGE_EVENT`.
- [ ] 9.2 Reduce `exchangeForSessionToken()` to a thin wrapper that calls `POST /auth/session/refresh` with `credentials: "include"` and returns the response token (no `x-auth-session-token` header).
- [ ] 9.3 Update `package/api/src/react-query/http.ts` to drop any `x-auth-session-token` header injection.
- [ ] 9.4 Update `AuthProvider` (`package/api/src/providers/AuthProvider.tsx`) to manage exactly one token (`REZICS_SESSION`), no AUTH_SESSION dependency chain.
- [ ] 9.5 Update `package/api/src/states/authSessionModel.ts` to derive `hasAuthIdentity` from server-side state (no JWT decoding) and `registrationStage` from slug-presence.
- [ ] 9.6 Update `package/api/src/auth/*` hooks to consume `userId`-shaped DTOs.

## 10. Frontend apps (`@rezics/app`, `@rezics/admin`)

- [ ] 10.1 Replace every `user.unitId` access with `user.userId` in `package/app/src/`.
- [ ] 10.2 Replace every `user.unitId` access with `user.userId` in `package/admin/src/`.
- [ ] 10.3 Update routes under `/_mainLayout/user/me/*` and any profile pages to use `userId` in URL params and query keys.
- [ ] 10.4 Remove any frontend code that decoded `auth-session-token` JWTs or stored them in localStorage.
- [ ] 10.5 Replace any `accountStatus` UI checks with `slug != null`/`slug == null` checks.
- [ ] 10.6 Sweep with `rg "unitId" package/app/src/ package/admin/src/` and review remaining hits (some may legitimately reference `unit.unitId`, which is unaffected).

## 11. Other consumer packages

- [ ] 11.1 Sweep `package/ui/src/`, `package/app-shell/src/`, `package/search/src/` for `user.unitId` and `accountStatus`; rename / remove.
- [ ] 11.2 Sweep `package/notify/`, `package/reaction/` for `NormalizedTokenName.AUTH_SESSION`; replace with `REZICS_SESSION` or remove if dead.

## 12. Seed restructure (cross-DB)

- [x] 12.1 Split `package/utils/src/seed/users.ts` into `seedAllAuthUsers(authPrisma, overwrite)` (phase 1, returns `Map<email, AuthSeedResult>`) and `seedAllMainUsers(serverPrisma, authResults)` (phase 2).
- [x] 12.2 Drop `accountStatus: "MEMBER_READY"` writes from `seedServerUser`; rename internal `unitId` argument to `userId`.
- [x] 12.3 Update `package/utils/src/seed/index.ts` orchestration to call phase 1, then phase 2.
- [x] 12.4 Extend `resetDatabase` in the seed CLI to also reset auth users, sessions, accounts, and verifications for seed users (currently only resets the server DB).

## 13. Factory mock seeding (`package/server/prisma/factory/`)

- [x] 13.1 Update `users.ts` to call `seedAuthUser(ctx.authPrisma, ...)` for each mock user before creating the main `User` row, and write the main row with `userId === authResult.userId`, `authUserId === authResult.userId`.
- [x] 13.2 Drop `accountStatus` writes from factory `seedUsers`; rename `unitId` field to `userId` on creation.
- [x] 13.3 Add `authPrisma: AuthPrismaClient` to `SeedCtx` in `package/server/prisma/factory/types.ts`; thread it through `orchestrator.ts` and `strategy.ts`.
- [x] 13.4 Update `package/server/prisma/factory/index.ts` and any callers of the orchestrator to construct and pass `authPrisma`.

## 14. Test updates

- [x] 14.1 Delete the `/session/exchange` test cases in `package/server/src/session/session.api.test.ts` (keep the surviving file or delete if all tests target the removed route).
- [x] 14.2 Update `package/server/src/auth-boundary/*.test.ts` to use `userId` and slug-presence instead of `unitId` and `accountStatus`.
- [x] 14.3 Update `package/server/src/middleware/permission.test.ts` for `userId` arg names and `permission.role` claim consumption.
- [x] 14.4 Update `package/server/src/user/api/*.test.ts` for renamed DTO fields.
- [x] 14.5 Update `package/server/prisma/factory/presets.test.ts` for cross-seeded mock users.
- [x] 14.6 Add a new test asserting that `slug !== null` is the readiness gate (e.g., `/auth/session/refresh` rejects a user with `slug: null` even when the auth session is valid).
- [x] 14.7 Add a new test asserting a factory-seeded mock user can complete a full sign-in round-trip against the auth service and obtain a `rezics-session-token` cookie.

## 15. Verification & cleanup

- [x] 15.1 Run `bun test` per package: `package/server`, `package/auth`, `package/contract`, `package/jwt`, `package/api`, `package/utils`, factory tests.
- [x] 15.2 Run `tsc --noEmit` per frontend package: `package/app`, `package/admin`, `package/ui`, `package/app-shell`, `package/search`.
- [x] 15.3 Run `bun run check:convention` from the root.
- [x] 15.4 Run `bun run knip` and inspect newly-orphaned exports; delete any.
- [x] 15.5 Final sweeps:
  - `rg "session/exchange" package/`
  - `rg "x-auth-session-token" package/`
  - `rg "AUTH_SESSION" package/`
  - `rg "accountStatus" package/`
  - `rg "UserAccountStatus" package/`
  - `rg "user(?:\.|\[\")unitId" package/`
  - `rg "auth-upstream" package/`
  - `rg "verifyAuth\b" package/`
  - All should return no hits (other than incidental matches in unrelated comments or in `openspec/`).
- [ ] 15.6 Bring up the dev stack (`bun run dev`) and exercise: sign-up → email verify → profile setup → sign-in → privileged route → sign-out. Confirm cookies are set/cleared correctly and no JWT-header headers are sent.
