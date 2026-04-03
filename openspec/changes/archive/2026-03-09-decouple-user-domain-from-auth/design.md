## Context

Current state:
- `build-independent-auth-server` is complete: `package/auth` runs as a dedicated IdP with better-auth, ES256 JWKS, OAuth 2.1/OIDC, and exported verification utilities.
- `package/server` has migrated JWT **verification** to JWKS-based `verifyBearerToken()` from `@rezics/auth/jwt`, but still retains all legacy auth **issuance** code paths (registration, login, refresh, password management, email verification, session management).
- `package/server/src/core.ts` still instantiates two `@elysiajs/jwt` HMAC plugins (`jwt` and `refreshToken`) even though they are bypassed by `verifyAuth()` in `utils.ts`.
- `package/app` and `package/api` still call server endpoints for login, register, and token refresh instead of the auth service.
- Two parallel user tables exist: `auth.User` (identity) and `server.User` (business profile), linked by matching UUIDv7 `id`/`unitId`.

Constraints and requirements:
- `package/auth` is frozen for this change — no modifications to the auth service.
- Server DB schema migration must cleanly drop auth-owned tables/columns.
- Frontend must transition from server-mediated auth to direct auth-service interaction.
- Lazy provisioning must handle the case where a valid JWT arrives but no business `User` record exists.
- All changes must preserve the existing `verifyAuth()` → `verifyBearerToken()` JWKS verification path.

Stakeholders:
- `package/server` (route cleanup, service cleanup, schema migration)
- `package/api` (auth client, token refresh)
- `package/app` (state management, UI pages, handlers)

## Goals / Non-Goals

**Goals:**
- Achieve complete separation: auth service owns identity lifecycle, server owns business profile data.
- Remove all dead/legacy auth code from `package/server`.
- Establish clean frontend auth architecture with separated concerns.
- Implement lazy user provisioning for seamless auth-to-business record creation.

**Non-Goals:**
- Redesigning the permission/RBAC model.
- Migrating existing user data between databases (separate operational concern).
- Changing `package/auth` internals.

## Decisions

### 1) Remove all auth issuance routes from package/server

Decision:
- Delete all routes that issue, refresh, or manage authentication tokens and credentials from `user.core.api.ts` and `user.verify.api.ts`.
- Remove the 410-guard `onBeforeHandle` in `user.api.ts` since the guarded routes will no longer exist.
- Remove `user.session.service.ts` entirely.

Rationale:
- These routes duplicate functionality now exclusively owned by `package/auth`. The 410 responses already signal deprecation. Removing them eliminates confusion and dead code.

Alternatives considered:
- Keep routes as permanent 410 stubs: rejected — adds maintenance burden with no value since clients must migrate anyway.

### 2) Strip auth-related business logic from UserService

Decision:
- Remove `authenticate()`, `verifyPassword()`, `resetPassword()`, `sendVerificationCode()`, `verifyVerificationCode()`, `resendVerificationCode()` from `user.service.ts`.
- Remove `nodemailer` transport, `SALT_ROUNDS`, and all password/email-verification imports.
- Remove `hashPassword()` and `verifyPassword()` from `utils.ts`.

Rationale:
- Credential verification, password management, and email verification are identity lifecycle concerns exclusively owned by `package/auth`. The server should only manage business profile CRUD.

Alternatives considered:
- Keep `hashPassword` for admin user creation: rejected — admin creation should also go through auth service, then the business record is provisioned.

### 3) Remove @elysiajs/jwt plugins from server coreInstance

Decision:
- Remove both `jwt({name: 'jwt', ...})` and `jwt({name: 'refreshToken', ...})` from `core.ts`.
- Remove `@elysiajs/bearer` (no longer needed since token extraction is handled by `verifyAuth()` parsing the `Authorization` header directly).
- Update all route handlers to remove `jwt`, `refreshToken`, `cookie: {refresh_token}` from destructured context.
- `verifyAuth()` in `utils.ts` already ignores the `jwtInstance` parameter (`void jwtInstance`), so this removal is safe.

Rationale:
- The HMAC JWT plugins are completely bypassed — `verifyAuth()` uses JWKS verification. Keeping them wastes memory, adds confusion, and inflates the Elysia context type.

Alternatives considered:
- Keep plugins as no-ops for type compatibility: rejected — adds confusion and false dependencies.

### 4) Server Prisma schema cleanup

Decision:
- Drop `AuthSession` model (session management is auth's concern via better-auth `Session`).
- Drop `VerificationCode` model (email verification is auth's concern via better-auth `Verification`).
- Drop `passwordHash` column from `User` model (credentials are stored in auth DB's `Account` model).
- Generate a Prisma migration for these schema changes.

Rationale:
- These models/columns duplicate data now exclusively managed by `package/auth`. Retaining them creates data inconsistency risks and maintenance burden.

Alternatives considered:
- Keep `passwordHash` as nullable for transition: rejected — no transition window is planned, and the field would never be written to again.

### 5) Lazy user provisioning on first authenticated access

Decision:
- When `verifyAuth()` succeeds (valid JWT with `unitId`, `slug`, `scope`) but `userService.getByUnitId(unitId)` returns null, auto-create a minimal business `User` record.
- Provisioned fields: `unitId` (from JWT `unitId`/`sub`), `slug` (from JWT), `name` (defaulted to `slug`), `email` (from JWT if available, or fetched from auth userinfo).
- Other fields (`avatar`, `bio`, `type`, `permission`) use defaults.

Rationale:
- Simpler than webhook-based provisioning — no inter-service coupling, handles edge cases naturally, works for any auth provider flow.
- Keeps the server stateless: it only needs the JWT to provision.

Alternatives considered:
- Auth webhook on `user.created`: rejected — adds coupling, requires auth service changes (violates non-goal), and is harder to debug.
- Manual admin provisioning: rejected — breaks self-service registration UX.

### 6) Frontend auth state separation

Decision:
- Split `userStore.ts` into two Zustand stores:
  - `authStore.ts`: owns `accessToken`, `isAuthenticated`, token refresh lifecycle. Persisted to `localStorage('auth-store')`.
  - `userProfileStore.ts`: owns `user: PartialUserDTO` (profile data). Persisted to `localStorage('user-profile')`. Populated by fetching `/users/me` after successful auth.
- `handler.ts` updated to call `authApi` for sign-in/sign-up/sign-out, then fetch profile into `userProfileStore`.
- `useAuth.ts` reads from `authStore` for authentication state.

Rationale:
- Clean separation of concerns: auth state changes independently from profile data. Logout clears auth without needing to know about profile shape. Profile can be refreshed without re-authenticating.

Alternatives considered:
- Single store with nested slices: rejected — still couples concerns and complicates selective persistence.
- Context-based auth state: rejected — Zustand is already the established pattern.

### 7) Frontend auth API client

Decision:
- Add `auth.api.ts` to `package/api` wrapping better-auth client SDK calls.
- Update `refreshAuthToken()` in `http.ts` to call the auth service's token endpoint instead of `/users/refresh-token`.
- Remove `login()` and `register()` from `user.api.ts`.

Rationale:
- Auth operations must target the auth service directly. The existing `user.api.ts` login/register methods call server endpoints that will be deleted.

Alternatives considered:
- Keep login/register in `user.api.ts` but redirect to auth URL: rejected — violates API client naming semantics and mixes concerns.

## Data Flow

### Authentication flow (target state)

```
Browser → package/app
  ├── LoginPage calls authApi.signIn(email, password)
  │     └── POST auth-service/api/auth/sign-in/email
  │           └── Returns: { session, token }
  ├── authStore.setToken(token)
  ├── handler fetches userApi.me()
  │     └── GET server/users/me (Bearer token)
  │           ├── verifyAuth() → verifyBearerToken(JWKS)
  │           ├── userService.getByUnitId(unitId)
  │           │     └── If null → lazy provision new User
  │           └── Returns: UserDTO
  └── userProfileStore.setUser(dto)
```

### Token refresh flow (target state)

```
package/api http.ts
  ├── apiFetch() gets 401
  ├── refreshAuthToken()
  │     └── POST auth-service/api/auth/token (with session cookie)
  │           └── Returns: { accessToken }
  ├── authStore.setToken(newToken)
  └── Retry original request with new token
```

### Ownership boundaries

```
┌──────────────────────────────────────────────────┐
│  package/auth DB (rezics_auth)                   │
│  OWNS: User identity, Session, Account,          │
│        Verification, Jwks, OAuth*                │
│  OPERATIONS: sign-in, sign-up, sign-out,         │
│              password reset/change, email verify, │
│              token issuance/refresh, JWKS rotate  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  package/server DB (rezics_book)                 │
│  OWNS: User profile (name, avatar, bio, desc,   │
│        type, permission, follow counts),         │
│        Follow, Unit, Book, Reaction, ApiToken    │
│  OPERATIONS: profile CRUD, follow/unfollow,      │
│              content management, search           │
└──────────────────────────────────────────────────┘
```

## Risks / Trade-offs

- [Risk] Lazy provisioning may create incomplete `User` records (missing email or profile data).
  → Mitigation: populate from JWT claims on first access; frontend prompts user to complete profile if fields are missing.

- [Risk] Dropping `passwordHash` is irreversible.
  → Mitigation: ensure all existing users have corresponding records in auth DB before migration. This is an operational prerequisite.

- [Risk] `refreshAuthToken()` redirect to auth service may fail if auth service URL is misconfigured in frontend env.
  → Mitigation: validate `VITE_AUTH_URL` at build time or app startup.

- [Risk] Removing `@elysiajs/jwt` plugins changes the Elysia context type, which may break type inference in route handlers.
  → Mitigation: update all route handler destructuring to remove `jwt`, `refreshToken`, `cookie: {refresh_token}` references. Run `tsc` to catch all breakages.

- [Trade-off] Two user tables (auth and server) require eventual consistency.
  → Acceptable: lazy provisioning handles creation; profile updates are server-only; identity changes (email) are auth-only. No bidirectional sync needed for current requirements.

## Migration Plan

### Phase 1: Server cleanup (backend-only, no frontend impact)

1. Remove auth routes from `user.core.api.ts` and `user.verify.api.ts`.
2. Remove 410-guard from `user.api.ts`.
3. Remove auth methods from `user.service.ts`.
4. Delete `user.session.service.ts` and `allowEmailDomains.ts`.
5. Clean up `utils.ts` (remove `hashPassword`, `verifyPassword`).
6. Remove `@elysiajs/jwt` plugins from `core.ts`.
7. Update route handlers to remove legacy context destructuring.
8. Remove unused imports (`uuid`, `setCookie`, session service, etc.).

### Phase 2: Server schema migration

9. Remove `passwordHash` from `User` model.
10. Remove `AuthSession` model.
11. Remove `VerificationCode` model.
12. Generate and apply Prisma migration.

### Phase 3: Lazy provisioning

13. Add lazy provisioning logic to `GET /users/me` handler.
14. Test with JWT from auth service where no server `User` record exists.

### Phase 4: Frontend auth redirect

15. Add `auth.api.ts` to `package/api`.
16. Update `http.ts` `refreshAuthToken()` to call auth service.
17. Split `userStore.ts` into `authStore.ts` and `userProfileStore.ts`.
18. Update `handler.ts` to use `authApi`.
19. Update `LoginPage.tsx`, `RegisterPage.tsx`, and `useAuth.ts`.
20. Remove `login()` and `register()` from `user.api.ts`.

### Phase 5: Validation

21. Run `tsc` across all affected packages.
22. Run existing e2e auth tests (update `auth.e2e.test.ts` for new flow).
23. Validate end-to-end: auth sign-in → bearer call to server → profile returned.
24. Validate lazy provisioning: new auth user → first `/users/me` → auto-created profile.

Rollback strategy:
- Git revert to pre-change branch state. Since this is pre-launch, rollback is code/deploy rollback.
- If only schema migration is applied, reverse migration can re-add dropped columns/tables.

## Open Questions

- Should the lazy-provisioned user record include `email` from JWT claims, or should email remain auth-only data that the server never stores? (Resolved)
- A: The server does not store email addresses. Lazy provisioning only persists `unitId`, `slug`, and profile defaults. When email is needed, it must be obtained from the auth service.
- Should `package/server/src/user/user.core.api.ts` `POST /create` (admin user creation) be retained as an admin-only provisioning endpoint, or should admin user creation also go through auth?
- A: The server backend should remove the administrator's ability to create users. The relevant functionality is implemented in the auth service. 
- What `VITE_AUTH_URL` environment variable should `package/app` use to locate the auth service, and should it be the same origin or a separate subdomain?
- A：It is an independent domain. In the backend, the frontend will run on rezics.com while the auth will run on auth.rezics.com. (Of course, there's more—like the frontend for book.rezics.com, the main backend for api.rezics.com, and so on and so forth.) Therefore, cookies and similar data will still be shared, which shouldn't pose a significant issue. 
- In short, we will operate under the same domain name, but I don't want the business logic to be tied to specific domain names. Domain configurations should reside in configuration files, such as environment variables.
