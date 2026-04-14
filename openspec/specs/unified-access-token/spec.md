## MODIFIED Requirements

### Requirement: Single access token replaces all service tokens

System SHALL use a single JWT access token — `rezics-session-token` — issued by the server as the sole bearer credential for all resource services (Server, Notify, Search, Reaction). The `auth-identity-token` issued by auth SHALL serve as an exchange/refresh token used exclusively to obtain the `rezics-session-token` via `POST /session/exchange`. The `auth-identity-token` SHALL NOT be sent via `Authorization: Bearer`.

#### Scenario: All services validate rezics-session-token

- **WHEN** any service (server, notify, search, reaction) receives an API request
- **THEN** it validates the `Authorization: Bearer` token as a `rezics-session-token` against the server's JWKS endpoint

#### Scenario: auth-identity-token is only used for exchange

- **WHEN** the frontend needs to obtain or refresh a `rezics-session-token`
- **THEN** it presents the `auth-identity-token` via the `x-auth-identity-token` header to `POST /session/exchange` on the server

### Requirement: Access token carries enriched claims for provisioning and gating

Auth service's `definePayload` SHALL produce JWT claims including `id` (auth user ID as sub), `slug`, `name`, `scope`, and conditionally `email_verified: false` when unverified. These claims are used by the server's exchange endpoint to validate identity. Resource servers read claims from the `rezics-session-token` (issued by server), not directly from the `auth-identity-token`.

#### Scenario: Auth identity token carries profile claims for exchange

- **WHEN** auth issues an `auth-identity-token`
- **THEN** the JWT payload includes `id`, `slug`, `name`, `scope`, and conditionally `email_verified`

## REMOVED Requirements

### Requirement: AUTH_CONTEXT token type is removed

**Reason**: Already removed in `pure-oauth-auth` change. No further action.
**Migration**: N/A — already completed.

### Requirement: REZICS_SESSION token type is removed

**Reason**: The `rezics-session-token` is being re-introduced with different semantics — issued by server via exchange endpoint, not by auth. The old removal (from `pure-oauth-auth`) stands; the new token is defined in the `server-access-token` capability.
**Migration**: The new `rezics-session-token` uses the same name but is architecturally distinct. Contract types are redefined under `server-access-token`.

### Requirement: Conditional email_verified claim semantics

**Reason**: Resource servers no longer read `email_verified` from the `auth-identity-token` directly. Verification gating, if needed, is handled during the token exchange flow — the server can check the claim on the `auth-identity-token` when issuing the `rezics-session-token` and refuse to issue if unverified.
**Migration**: Verification checks move to the exchange endpoint or remain as a frontend-only gate.
