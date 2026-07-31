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
`resolveIdentity(request, permission)`. The explicit permission is mandatory
when a bearer credential is present. Expensive public operations also pass a
stable quota operation ID. API-token concurrency leases remain attached to the
request until `afterResponse`, including error responses.

## API-key capability boundary

`api-permissions.ts` is the canonical registry for every API-key permission.
The public flat values, TypeBox request contract, Better Auth permission
statements, verification, and presentation all derive from this registry.
Unit resources use `unit:read`, `unit:create`, and `unit:update`;
authorization remains under the single `unit:*` namespace.

API-key permission is only an API entry capability. It does not prove that the
actor may edit a particular object. Unit ownership, scoped permission grants
and restrictions, active Realm membership, bans, and visibility all remain
domain authorization decisions. Those checks are identical for session and
API-key identities.

API keys use the `rz_api_` prefix, are SHA-256 hashed by Better Auth, and expire
after 90 days by default (maximum 365 days). Better Auth retains its
credential-verification abuse limiter. Product capacity is enforced separately
by the account quota system described in
[`docs/architecture/api-quotas.md`](../../../../../docs/architecture/api-quotas.md).
The full secret is returned once at creation.

## API quotas

The authenticated Better Auth user ID is the hard quota principal. Every token
for that account consumes the same account-global and operation-specific rate,
concurrency, and UTC daily-cost constraints. Creating another token therefore
does not create capacity. A token may have an additional owner-managed
safeguard, but it is evaluated alongside the account constraints and can only
make that token more restrictive.

Quota admission is one PostgreSQL transaction protected by sorted advisory
locks. A denial rolls back every tentative counter and lease. Accepted daily
cost is not refunded after handler entry; concurrency leases are released after
the response and have a bounded expiry for crash recovery. The worker removes
expired leases, reservations, and bounded historical state.

## Credential control-plane

The application API at `/api/api-tokens` is the only API-key management
surface. Listing, creating, and revoking keys require a fresh interactive
session. Better Auth's direct API-key HTTP management paths are disabled, and
API-key session emulation remains disabled.

Authentication failures are `401`; an authenticated actor denied an operation
receives `403`; API-key quota denial returns `429` with `Retry-After`. Visibility
checks use `404` when revealing target existence would leak information. The
domain rules are documented in `authorization/README.md`.
