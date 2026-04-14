## REMOVED Requirements

### Requirement: Auto-provision business user record on first authenticated access

**Reason**: Replaced by the `auth-user-provisioning-hook` capability. User provisioning is now guaranteed at registration time via auth's `afterSignUp` hook calling the server's internal provisioning endpoint. The server user record exists before the user's first API call.
**Migration**: Remove the provisioning logic from `requireOwner` resolve function (which is itself being deleted). Remove `provisionFromJwt` and `provisionFromAuthContext` calls from middleware. The server's internal provisioning endpoint (`POST /internal/users/provision`) replaces the lazy path.

### Requirement: Lazy provisioning is idempotent

**Reason**: The new provisioning endpoint maintains idempotency via `INSERT ... ON CONFLICT (unitId) DO NOTHING`. The guarantee is preserved but moved from middleware to a dedicated endpoint.
**Migration**: Idempotency logic in `userService.provisionFromJwt` is reused by the internal provisioning endpoint.

### Requirement: Lazy provisioning applies to all owner-level endpoints

**Reason**: With `requireOwner` deleted and provisioning moved to registration, no endpoint triggers lazy provisioning. All authenticated endpoints can assume the user exists.
**Migration**: Remove all provisioning side effects from middleware. If a `requireLogin` request encounters an unknown `unitId` (which should not happen under normal flow), return 401 — the user must re-authenticate.
