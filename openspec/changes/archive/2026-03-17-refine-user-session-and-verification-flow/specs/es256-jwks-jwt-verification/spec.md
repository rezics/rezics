## MODIFIED Requirements

### Requirement: Shared JWT verification is parameter-driven

`package/auth/src/jwt/verify.ts` SHALL expose verification helpers that run from caller-supplied parameters rather than reading env directly. The caller SHALL provide the issuer configuration, verification key or secret input, and any token-purpose or transport expectations needed for validation.

#### Scenario: Server verifies token with explicit parameters

- WHEN `package/server` uses the shared verifier
- THEN it SHALL provide verification parameters explicitly
- AND the shared verifier SHALL validate the token without importing auth-package env configuration

#### Scenario: Auth verifies `auth_context_token` with the shared core

- WHEN `package/auth` verifies `auth_context_token`
- THEN it SHALL use the same parameter-driven verifier core used for `auth_identity_token`
- AND the verifier SHALL support the token's issuer and signing-key configuration explicitly

### Requirement: Env-bound verifier wrappers live in separate auth-only files

Any helper that resolves verifier inputs from env SHALL live outside `package/auth/src/jwt/verify.ts` in a separate file under the same folder. `package/auth/src/jwt/index.ts` MAY export those wrappers for auth-package use, but `package/server` SHALL NOT depend on them.

#### Scenario: Auth package uses env-bound wrapper

- WHEN auth-local code wants a convenience verifier bound to auth env configuration
- THEN it MAY import an auth-only wrapper from `package/auth/src/jwt/index.ts`
- AND that wrapper SHALL delegate to the parameter-driven core in `verify.ts`

#### Scenario: Server does not import auth env-bound wrapper

- WHEN `package/server` needs JWT verification
- THEN it SHALL import the parameter-driven verifier or a server-local wrapper that supplies parameters
- AND it SHALL NOT import auth-only env-bound wrappers
