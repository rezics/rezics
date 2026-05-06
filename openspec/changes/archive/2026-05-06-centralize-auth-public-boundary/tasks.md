## 1. Configuration and Boundary Setup

- [x] 1.1 Add or rename server/auth environment variables for auth internal base URL, public auth base URL, and public issuer URL.
- [x] 1.2 Update runtime env validation in `package/server` and `package/auth` for the new auth URL split.
- [x] 1.3 Update development `.env` examples or docs so browser-facing auth URLs point to main `/auth/*`.
- [x] 1.4 Add a public route classification table in server code or docs for auth-domain, main-domain, and mixed `/auth/*` routes.

## 2. Main Auth Public Proxy

- [x] 2.1 Implement main server `/auth/*` routing that maps eligible public paths to auth internal `/api/auth/*`.
- [x] 2.2 Preserve request method, query string, body, selected headers, and auth session cookies when proxying auth-owned routes.
- [x] 2.3 Normalize proxied `Set-Cookie` headers so auth session cookies use public `Path=/auth`.
- [x] 2.4 Normalize proxied redirect `Location` headers so browser-visible redirects use main public URLs.
- [x] 2.5 Block or omit public exposure of `GET /auth/token` and any equivalent auth session JWT acquisition path.
- [x] 2.6 Add tests for proxy path mapping, cookie path rewriting, redirect rewriting, and blocked token exposure.

## 3. Session Refresh and Cookie Transport

- [x] 3.1 Implement main-owned `POST /auth/session/refresh`.
- [x] 3.2 Validate the opaque auth session cookie by calling auth internally instead of parsing it in main.
- [x] 3.3 Provision or verify the corresponding main user and readiness state during refresh.
- [x] 3.4 Issue or refresh `rezics-session-token` as an httpOnly cookie with production-safe attributes.
- [x] 3.5 Stop returning browser-storable main session JWTs from normal web refresh/exchange flows.
- [x] 3.6 Add CSRF and origin checks for `/auth/session/refresh`, sign-out, and other cookie-authenticated mutating auth routes.
- [x] 3.7 Ensure sign-out clears the main `rezics-session-token` cookie and delegates auth session invalidation to auth.
- [x] 3.8 Add targeted tests for valid refresh, invalid auth session, missing main user/readiness failure, CSRF rejection, and sign-out cookie clearing.

## 4. Auth OAuth, JWKS, and Metadata

- [x] 4.1 Update auth OAuth/OIDC configuration so public issuer and endpoint URLs are generated from public main config.
- [x] 4.2 Ensure public OAuth routes are reachable through main `/auth/oauth/*` and callbacks through `/auth/callback/:provider`.
- [x] 4.3 Preserve standards-based public `POST /auth/oauth/token` while keeping auth session JWT acquisition blocked.
- [x] 4.4 Publish auth/OIDC JWKS through an auth-scoped public path such as `/auth/session/jwks`.
- [x] 4.5 Keep main `/.well-known/jwks.json` reserved for `rezics-session-token` verification.
- [x] 4.6 Add or update discovery metadata so it advertises public main URLs and never internal auth service URLs.
- [x] 4.7 Verify auth admin, organization, OAuth registration, and auth JWKS service routes continue to authorize inside auth.
- [x] 4.8 Add tests or contract checks for discovery metadata, JWKS separation, OAuth endpoint URLs, and auth-domain authorization pass-through.

## 5. Main-Domain Authorization and Token Wallet

- [x] 5.1 Identify `/auth/*` routes that mutate main DB, main permissions, main sessions, main admin state, or main token wallet state.
- [x] 5.2 Add main `rezics-session-token` and main DB authorization checks to every main-domain route identified in 5.1.
- [x] 5.3 Split mixed auth/main routes where practical into separate auth-domain and main-domain operations.
- [x] 5.4 For unsplit mixed routes, perform main authorization first and call auth internally with service context.
- [x] 5.5 Create or designate the main token wallet module boundary for future external/resource tokens.
- [x] 5.6 Ensure auth does not directly read or mutate main token wallet storage.
- [x] 5.7 Add tests for main-domain authorization under `/auth/*` and auth-domain proxy routes without duplicate main auth-role checks.

## 6. Contract and Token Claim Migration

- [x] 6.1 Update `@rezics/contract` session/token schemas so `rezics-session-token.sub` and explicit actor fields represent `userId`.
- [x] 6.2 Remove `unitId` as the trusted actor identity from main session claim contracts.
- [x] 6.3 Update server token signing and verification code to issue and validate actor `userId` claims.
- [x] 6.4 Update auxiliary services that verify `rezics-session-token` to read actor `userId`.
- [x] 6.5 Preserve API token behavior for `/token/*` and `/dispatch/*` bearer authentication.
- [x] 6.6 Add tests for claim schema, actor identity verification, stale-role rejection behavior, and service verification compatibility.

## 7. Frontend and API Client Migration

- [x] 7.1 Replace browser usage of direct auth host env variables with main-relative `/auth/*` routes in `package/api`, `package/app`, and `package/admin`.
- [x] 7.2 Remove normal web storage of `rezics-session-token` and auth session JWTs from localStorage.
- [x] 7.3 Remove frontend JWT parsing for auth capability, role, email verification, user identity, and unit identity.
- [x] 7.4 Update API client request handling to rely on credentials-included cookies and refresh through `/auth/session/refresh`.
- [x] 7.5 Update login, social sign-in, callback, sign-out, and post-auth navigation flows to complete through main.
- [x] 7.6 Update `authSessionStore`, `useAuth()`, and profile/session hydration code to consume server session state.
- [x] 7.7 Add frontend/API tests for session hydration, anonymous state, member state, verification state, refresh retry, and sign-out.

## 8. User and Unit Identity Audit

- [x] 8.1 Use repo-wide search to list all `userId`, `unitId`, `userSlug`, and `unitSlug` usages in contracts, server, auth, API clients, app, admin, and services.
- [x] 8.2 Classify each usage as actor user identity, owner user identity, domain unit identity, user slug, or unit slug.
- [x] 8.3 Rename route params, props, DTO fields, and local variables that currently imply `userId = unitId`.
- [x] 8.4 Update Prisma schema or service access patterns so Unit ownership references explicit user identity rather than accidental unit identity.
- [x] 8.5 Update user profile and unit lookup routes so user slug and unit slug namespaces are not conflated.
- [x] 8.6 Add migration notes and database migration tasks for any schema-level user/unit identity changes.
- [x] 8.7 Add tests covering ownership checks, profile lookup by user slug, unit lookup by unit slug, and actor identity authorization.

## 9. Service Boundary Review

- [x] 9.1 Audit reaction service endpoints and classify which can continue independently with only `rezics-session-token`.
- [x] 9.2 Identify service endpoints that need main proxy because they require non-`userId` main context or main-owned mutations.
- [x] 9.3 Update service auth macros or clients to support cookie-originated main sessions where services are reached through main, and bearer verification where services remain independently reachable.
- [x] 9.4 Add service tests for independently verifiable endpoints and main-proxied endpoints.

## 10. Validation and Documentation

- [x] 10.1 Run targeted `bun test` suites for changed auth, server, API client, and service modules.
- [x] 10.2 Run TypeScript/build checks for affected packages.
- [x] 10.3 Run repo-wide searches to confirm no browser code depends on `VITE_AUTH_API_URL` or direct `auth.rezics.com` for normal web auth flows.
- [x] 10.4 Run repo-wide searches to confirm no normal browser flow stores `rezics-session-token` or auth session JWTs in localStorage.
- [x] 10.5 Run repo-wide searches to confirm no new code treats `unitId` as the authenticated actor identity.
- [x] 10.6 Document that `auth.rezics.com` is not a public product API despite retaining public DNS.
- [x] 10.7 Document public OAuth redirect URI and discovery metadata expectations for deployments.
- [x] 10.8 Verify OpenSpec status and archive readiness after implementation tasks are complete.
