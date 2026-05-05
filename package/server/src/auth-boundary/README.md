# Auth Public Boundary

Main owns the browser-facing `/auth/*` boundary. Auth-owned routes are proxied
to the auth service internal `/api/auth/*` paths and remain authorized by auth.

## Route Ownership

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

## Token Wallet Boundary

The main token wallet boundary is `package/server/src/token` backed by the
server Prisma `ApiToken` model. This module owns API token creation, update,
revocation, listing, and verification for `/token/*` and `/dispatch/*` API
token flows.

Auth must not import this module, query the server `ApiToken` model, or mutate
main token wallet storage. If an auth-owned flow needs token-wallet context,
main must authorize the operation first and pass only the required context to
auth through an internal call.
