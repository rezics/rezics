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

## ADDED Requirements

### Requirement: Provisioning is exclusively cookie-boundary or registration-hook

After this change, the only paths that materialize a main `User` SHALL be: (1) the cookie-boundary `materializeMainAccountFromAuth` flow, invoked when the browser starts main-orchestrated account setup with a verified auth session; and (2) the registration-side `auth-user-provisioning-hook` flow (when configured), invoked from auth's `afterSignUp`/verify-email path via an internal call to main. No JWT-in-header exchange path SHALL exist for provisioning. No middleware-resident "lazy provisioning" SHALL be triggered on first authenticated request.

#### Scenario: First authenticated request encounters missing main user

- **WHEN** a request reaches a member-only endpoint with a valid `rezics-session-token` but the main `User` row has been removed
- **THEN** the endpoint SHALL return 401 (the user must re-authenticate)
- **AND** the middleware SHALL NOT auto-create or auto-restore the user

#### Scenario: Cookie boundary materializes main user during account setup

- **WHEN** an authenticated browser with a verified auth session initiates `materializeMainAccountFromAuth`
- **THEN** main SHALL create a profile-setup-stage `User` (with `slug === null`) and issue a `rezics-profile-setup-token` cookie
- **AND** no JWT-in-header pathway SHALL be used

#### Scenario: Header-based provisioning JWT is rejected

- **WHEN** any caller sends an `x-auth-session-token` to any provisioning-eligible endpoint
- **THEN** the header SHALL be ignored and SHALL NOT trigger provisioning
