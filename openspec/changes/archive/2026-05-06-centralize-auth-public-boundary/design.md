## Context

The current unreleased auth design lets browser code call auth directly, exchange browser-visible auth JWT material for a main `rezics-session-token`, and store normal web session tokens outside httpOnly cookies. Main and auth also have overlapping responsibilities around login completion, OAuth callbacks, session refresh, and token exposure.

The target architecture makes main the public orchestration boundary. Product clients call `https://rezics.com/auth/*`; main maps those requests to auth internal native routes where the operation belongs to auth, and main handles any operation that mutates or authorizes main-owned state. Auth keeps its better-auth implementation and internal `/api/auth/*` base path. The public auth host DNS can remain available for deployment, but it is not a product or OAuth integration contract.

The change crosses `package/server`, `package/auth`, `package/api`, `package/app`, `package/admin`, shared contracts, and services that verify `rezics-session-token`.

## Goals / Non-Goals

**Goals:**

- Expose one public auth boundary at `rezics.com/auth/*`.
- Preserve auth package native internal routes and OAuth implementation.
- Use an opaque auth session cookie as refresh authority for the main session.
- Store browser web credentials in httpOnly cookies.
- Keep auth-domain authorization in auth and main-domain authorization in main.
- Separate internal auth service URL, public auth URL, and public issuer configuration.
- Audit actor `userId` separately from domain `unitId` and slug fields.

**Non-Goals:**

- Supporting the temporary unreleased localStorage token exchange design.
- Making main parse auth session internals or auth roles.
- Requiring auth to notify main after login.
- Moving the external/resource token wallet into auth.
- Forcing code-level rejection of all direct `auth.rezics.com` traffic in the first change.

## Decisions

### Main owns the public auth boundary

Public product and OAuth clients SHALL use main paths under `/auth/*`. Main maps public `/auth/*` to auth internal `/api/auth/*` for auth-owned routes, including better-auth native routes and OAuth provider routes.

Alternative considered: expose auth directly and have auth notify main after login. This was rejected because it creates cross-service public coupling and forces auth to understand main readiness/provisioning needs.

### Auth session cookie is the refresh authority

The existing opaque auth session cookie remains the authority for refreshing a browser main session. Main exposes `/auth/session/refresh`, forwards the auth session cookie to auth internally for validation/session state, provisions or checks main user readiness, then sets `rezics-session-token` as an httpOnly cookie.

Alternative considered: add a separate main refresh token immediately. This was rejected for the minimum design because the auth session already represents the long-lived login authority, and a second refresh credential adds revocation and storage complexity before there is a concrete independent-main-refresh requirement.

### Authorization stays with the owning domain

For auth-domain routes, main acts as a transport boundary and does not enforce auth roles. Auth session cookies are opaque to main, so auth remains responsible for auth admin, organization, OAuth client, and auth JWKS service authorization.

For main-domain routes, main performs main authorization using the main session and main database. This includes main admin state, main token wallet state, main session revocation, main permission changes, and any route that mutates main DB state, even when the public route is grouped under `/auth/*`.

Alternative considered: centralize all auth and main permissions in main. This was rejected because main cannot safely derive auth roles from an opaque auth session and would duplicate auth's policy model.

### OAuth protocol remains auth-owned but public metadata is main-owned

Auth continues to implement OAuth/OIDC provider behavior. Main publishes or proxies public OAuth endpoints under `/auth/oauth/*` and callback endpoints under `/auth/callback/*`. Public discovery metadata advertises main URLs and does not expose internal auth URLs.

The default public issuer for OAuth/OIDC metadata is `https://rezics.com`, with endpoint URLs under `https://rezics.com/auth/*`. This avoids path-based issuer discovery ambiguity while keeping all auth proxy paths grouped under `/auth`. Main-owned root discovery metadata can point to `/auth/*` endpoints without being a blind auth proxy.

Alternative considered: use `https://rezics.com/auth` as the issuer. This keeps the issuer visually tied to auth, but path-based issuer discovery is more error-prone across clients and libraries.

### JWKS ownership is explicit

Main keeps `/.well-known/jwks.json` for `rezics-session-token`. Auth/OIDC signing keys are exposed only under an auth-scoped public path such as `/auth/session/jwks`, and OAuth/OIDC metadata points to that path.

Alternative considered: reuse main `/.well-known/jwks.json` for auth/OIDC tokens. This was rejected because it mixes distinct token issuers and key lifecycles.

### Main owns the external token wallet

Future external/resource API token storage belongs to main. Auth can receive token context from main during flows that need it, but auth does not own the general-purpose external token wallet. Auth DB remains responsible for auth identity, account links, sessions, organizations, and OAuth client data.

Alternative considered: store future resource tokens in auth because auth owns login and OAuth. This was rejected because resource tokens are used by main and product services, and tying them to auth would expand auth beyond identity and authorization-server concerns.

### User and unit identity are audited as distinct concepts

The main session actor identity is `userId` in `sub` and explicit claim fields. `unitId` remains a domain/content identifier and must not be treated as the authenticated actor ID. User slugs and unit slugs are likewise separate.

Alternative considered: preserve the historical `User.unitId` primary-key pattern as the actor identity. This was rejected because it embeds accidental equivalence into tokens, route params, and authorization checks.

## Risks / Trade-offs

- Cookie path rewriting can be incomplete -> configure auth cookie paths directly where possible and add proxy tests that inspect `Set-Cookie` and redirect `Location` headers.
- OAuth discovery or issuer metadata can drift from public routes -> generate metadata from public auth configuration and test discovery documents in integration tests.
- Cookie-backed writes increase CSRF exposure -> require SameSite=Lax cookies plus origin/CSRF checks on refresh, sign-out, and mutating auth/main endpoints.
- Direct auth host usage can leak into clients -> remove browser auth-host env usage and document `auth.rezics.com` as non-public; add deployment checks later if documentation is insufficient.
- User/unit migration can touch many packages -> perform an audit first, then migrate contracts and tokens before feature-specific route cleanup.
- Auxiliary services may currently expect bearer tokens -> keep bearer verification available for service/API-token flows while browser web flows use cookies.

## Migration Plan

1. Add auth configuration split: internal auth base URL, public auth base URL, and public issuer URL.
2. Add main `/auth/*` proxy path mapping to auth internal `/api/auth/*`, including cookie path and redirect URL normalization.
3. Add public endpoint restrictions so auth session JWT acquisition is not exposed as `GET /auth/token`.
4. Implement `/auth/session/refresh` in main and set `rezics-session-token` as an httpOnly cookie.
5. Update auth OAuth/OIDC discovery and JWKS metadata to advertise main public URLs.
6. Update frontend API clients and apps to use main `/auth/*` and cookie-backed session hydration.
7. Remove localStorage JWT storage and parsing from normal browser auth state.
8. Audit user/unit identifiers in contracts, session claims, route params, Prisma usage, services, and UI props.
9. Verify independently operating services, such as reaction endpoints, can still validate `rezics-session-token` without main proxy when they only need actor `userId`.
10. Roll out in development and staging before public release; no compatibility bridge is required for the old temporary design.

Rollback before public release is to restore the previous dev-only auth URL and token exchange behavior from source control. After release, rollback would require keeping cookie names stable and reverting route mapping only behind deployment configuration.

## Open Questions

No blocking product decisions remain for this proposal. Non-blocking implementation checks are:

- Whether better-auth can directly configure public cookie path `/auth` or whether main must rewrite `Set-Cookie` headers.
- Whether any OAuth client library requires a mirrored auth-scoped discovery URL in addition to main root discovery metadata.
- Whether future independent main refresh revocation justifies adding a separate main refresh token after the initial cookie refresh design ships.
