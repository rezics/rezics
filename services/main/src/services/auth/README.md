# Authentication

Better Auth is the sole owner of credentials, password verification, cookies,
sessions, and API keys. Backend code never accepts a client-provided profile ID
as identity.

## Request identity

`session.ts` is the only bridge from an HTTP request to application identity.
It resolves either an interactive Better Auth session or a Better Auth API key,
then constructs the same request-scoped `Authorization(profile.unitId)` for
both. An explicit `Authorization: Bearer rz_api_...` header takes precedence
over an ambient cookie; an invalid bearer credential never falls back to the
cookie or to anonymous access.

Routes declare one `access` requirement. Examples:

- `access: "unit:read"` allows sessions and API keys with `unit:read`.
- `access: "contribute:unit:create"` first checks an API key's `unit:create`
  permission, then applies the account contribution policy to either identity.
- `access: "write:interaction:write"` applies the common account write policy.
- `access: "session-only"` rejects API keys.
- `access: "fresh-session-only"` additionally requires a session created in
  the last ten minutes.

Public routes that optionally personalize a response call
`resolveIdentity(headers, permission)`. The explicit permission is mandatory
when a bearer credential is present.

## API-key capability boundary

`api-permissions.ts` is the canonical registry for every API-key permission.
The public flat values, TypeBox request contract, Better Auth permission
statements, verification, and presentation all derive from this registry.
Catalog objects use `unit:read`, `unit:create`, `unit:update`, and `unit:delete`;
there is intentionally no parallel `catalog:*` namespace.

API-key permission is only an API entry capability. It does not prove that the
actor may edit a particular object. Unit ownership and collaborators, profile
ownership, locks, Realm membership and capabilities, bans, and visibility all
remain domain authorization decisions. Those checks are identical for session
and API-key identities.

API keys use the `rz_api_` prefix, are SHA-256 hashed by Better Auth, expire
after 90 days by default (maximum 365 days), and are limited to 300 requests per
60-second window with database-backed counters. The full secret is returned
once at creation.

## Credential control-plane

The application API at `/api/api-tokens` is the only API-key management
surface. Listing, creating, and revoking keys require a fresh interactive
session. Better Auth's direct API-key HTTP management paths are disabled, and
API-key session emulation remains disabled.

Authentication failures are `401`; an authenticated actor denied an operation
receives `403`; API-key throttling returns `429` with `Retry-After`. Visibility
checks use `404` when revealing target existence would leak information. The
domain rules are documented in `authorization/README.md`.
