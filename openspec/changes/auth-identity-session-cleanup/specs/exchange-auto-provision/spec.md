## REMOVED Requirements

### Requirement: Auto-provision on exchange

**Reason**: The `POST /session/exchange` endpoint is being deleted in this change. Provisioning is handled exclusively by the cookie-boundary path (`materializeMainAccountFromAuth` / `refreshMainSessionFromAuth`) which derives identity from the validated auth session cookie. There is no JWT-in-header exchange to auto-provision against.
**Migration**: Provisioning is unified under the cookie boundary capabilities (`opaque-auth-session-refresh`, `main-owned-account-registration`). The `provisionFromJwt` helper is deleted along with `/session/exchange`. No client should depend on auto-provisioning via JWT exchange.

### Requirement: Eager provisioning via JWT-based exchange

**Reason**: The auth service no longer signs an `auth-session-token` for eager provisioning, and the receiving endpoint (`POST /session/exchange`) no longer exists. Eager provisioning over the JWT-header path is dead.
**Migration**: Eager provisioning at registration is handled by the auth-side `afterSignUp` / verify-email path calling the main service's internal provisioning endpoint when configured (covered by `auth-user-provisioning-hook`). The cookie-boundary `materializeMainAccountFromAuth` covers the remaining case where the user reaches main-orchestrated account setup with only an auth session.

### Requirement: Auth-presence cookie on OTP verification

**Reason**: This requirement remains valid in spirit but is owned by the cookie-boundary capabilities (`cross-site-auth-presence`, `opaque-auth-session-refresh`), not by an exchange-based capability. Keeping it under "exchange-auto-provision" is misleading because OTP verification no longer triggers an exchange call.
**Migration**: The auth-presence cookie behavior is preserved under the auth-owned session-establishment path. No client behavior change.

### Requirement: Documentation (JSDoc)

**Reason**: The `/session/exchange` endpoint is deleted; JSDoc explaining its `unitId` mapping is no longer relevant. The `databaseHooks.user.create.after` JSDoc is owned by `auth-user-provisioning-hook`.
**Migration**: Documentation moves to the surviving capabilities.
