# Auth Public Boundary

Main owns the browser-facing `/auth/*` boundary. Auth-owned routes are proxied
to the auth service internal `/api/auth/*` paths and remain authorized by auth.

`auth.rezics.com` may keep public DNS for deployment checks and diagnostics, but
it is not a public product API. Browser product code, email links, OAuth
redirect URIs, and OAuth/OIDC discovery metadata must use the main public
boundary at `https://rezics.com/auth/*`.

## Route Ownership

Route ownership is documented on the Elysia route definitions in
`auth-public.api.ts` through OpenAPI `detail` metadata. This table is an
architectural summary only.

| Public route | Owner | Main authorization |
| --- | --- | --- |
| `/auth/session/refresh` | Main | Validates the opaque auth session through auth, then checks/provisions main user readiness before issuing the main session cookie. |
| `/auth/sign-out` | Mixed | Clears the main session cookie and delegates auth session invalidation to auth. |
| `/auth/token` | Auth, internal-only | Not exposed publicly through main. |
| `/auth/session/jwks` | Auth | Public verifier endpoint; no main role check. |
| `/auth/oauth/*` | Auth | OAuth/OIDC protocol handling remains auth-owned. |
| `/auth/callback/:provider` | Auth | Social callback handling remains auth-owned. |
| `/auth/admin/*` | Auth | Auth enforces auth admin policy; main only proxies the opaque auth cookie. |
| `/auth/organization/*` | Auth | Auth enforces organization policy; main only proxies the opaque auth cookie. |

No current `/auth/*` route mutates main token wallet entries, main permission
records, or main admin state. Future `/auth/*` routes that do so must be
implemented in main and must use main authorization before calling auth.

`/auth/session/refresh` is the only current main-domain `/auth/*` operation.
It does not trust browser-provided main session material; it validates the
opaque auth session through auth, verifies or provisions the main user through
the main database, and only then issues the main session cookie.

`/auth/sign-out` remains the only current mixed route. The main-owned part is
limited to clearing the caller's main session cookie, so it does not require a
main DB authorization check before delegating auth session invalidation to auth.

## Token Wallet Boundary

The main token wallet boundary is `package/server/src/token` backed by the
server Prisma `ApiToken` model. This module owns API token creation, update,
revocation, listing, and verification for `/token/*` and `/dispatch/*` API
token flows.

Auth must not import this module, query the server `ApiToken` model, or mutate
main token wallet storage. If an auth-owned flow needs token-wallet context,
main must authorize the operation first and pass only the required context to
auth through an internal call.

## Deployment Metadata

Public OAuth redirect URIs must target main-owned auth paths such as
`https://rezics.com/auth/callback/:provider`. OAuth/OIDC discovery documents
must advertise public main URLs and must not expose internal service URLs such
as `AUTH_INTERNAL_BASE_URL` or auth-native `/api/auth/*` paths.

Main-owned session JWKS remain at `https://rezics.com/.well-known/jwks.json`.
Auth/OIDC JWKS are published only through an auth-scoped public path such as
`https://rezics.com/auth/session/jwks`.
