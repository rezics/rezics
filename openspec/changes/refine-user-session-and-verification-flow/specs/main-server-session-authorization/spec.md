## ADDED Requirements

### Requirement: Main server issues a dedicated session token after successful ensure handoff

The main server SHALL issue `rezics_session_token` only after a user has passed auth verification, the server has checked the existing auth session-state API needed to confirm the current login and verification state, and the `GET /users/ensure` handoff has completed successfully.

#### Scenario: Ensure response establishes main-server session

- **WHEN** a verified auth user calls `GET /users/ensure` successfully
- **THEN** the main server SHALL issue or refresh `rezics_session_token`
- **AND** it SHALL transport that token via `x-rezics_session_token`
- **AND** the token SHALL be bound to the main-server issuer rather than the auth issuer

#### Scenario: Unverified auth user does not receive main-server session token

- **WHEN** an auth-session user has not completed the required verification or readiness flow
- **THEN** the main server SHALL NOT issue `rezics_session_token`
- **AND** it SHALL leave the user in a pending-verification or not-ready state

#### Scenario: Expired main-server session is refreshed from valid auth identity

- **WHEN** `rezics_session_token` has expired and the client presents a valid `auth_identity_token`
- **THEN** the main server SHALL re-check auth session state through the auth-owned session-state API
- **AND** it SHALL issue a replacement `rezics_session_token` only if the user is still logged in and eligible

#### Scenario: Main-server session refresh never proceeds without auth identity

- **WHEN** `auth_identity_token` is missing, expired, or cannot be refreshed
- **THEN** the client SHALL NOT attempt to refresh `rezics_session_token`
- **AND** the main server SHALL treat the caller as lacking a refreshable main-server session

### Requirement: Main-server session token carries a permission snapshot for request prefiltering

`rezics_session_token` SHALL include only the current main-server role under `permission.role` for fast authorization checks and SHALL NOT duplicate mutable resource-level permission details in the token payload at this stage.

#### Scenario: Token payload includes permission snapshot

- **WHEN** the main server signs `rezics_session_token`
- **THEN** the payload SHALL include a `permission.role` value that reflects the user's current server role
- **AND** it SHALL NOT embed `permission.resource` details in the token payload
- **AND** it SHALL include expiration metadata needed for automatic refresh scheduling

#### Scenario: Protected route rejects unauthorized snapshot before database query

- **WHEN** a protected main-server route receives `rezics_session_token` whose `permission.role` cannot satisfy the requested action
- **THEN** the route SHALL reject the request before performing the main business database query

### Requirement: Database permissions remain authoritative after token prefiltering

Main-server permission-protected routes SHALL re-check the user's persisted permissions after token prefiltering so freezes, revocations, or role changes take effect immediately.

#### Scenario: Persisted permission downgrade overrides stale token snapshot

- **WHEN** `rezics_session_token` permits an action but the user's current database permission has been downgraded or frozen
- **THEN** the route SHALL deny the action after loading the current user permission state
- **AND** the main-server response SHALL reflect the database-authoritative denial

#### Scenario: Snapshot and database permission both allow action

- **WHEN** the token snapshot and the current database permission both allow the requested action
- **THEN** the route SHALL continue to the business handler normally

### Requirement: Permission-protected routes use middleware-hydrated session context

Main-server routes that require permission authorization SHALL verify `x-rezics_session_token` in middleware, expose the verified payload as request context, and consume that context directly in handlers rather than re-verifying the token per handler.

#### Scenario: Permission route consumes session context from middleware

- **WHEN** a main-server route requires permission authorization
- **THEN** middleware SHALL verify `x-rezics_session_token` before the handler runs
- **AND** the verified payload SHALL be available to the handler as `ctx.session`
- **AND** the handler SHALL use `ctx.session.permission.role` for the prefilter step before loading database permissions
