## MODIFIED Requirements

### Requirement: Login flow performs two-step token acquisition

Login handler SHALL perform a three-step sequence: (1) sign in via Better Auth API, (2) obtain `auth-identity-token` via `ensureAuthIdentityToken()`, (3) exchange `auth-identity-token` for `rezics-session-token` via `POST /session/exchange`. Registration handler SHALL follow the same pattern — the `afterSignUp` hook guarantees the server user exists, so no explicit `/users/ensure` call is needed.

#### Scenario: Login acquires both tokens

- **WHEN** a user logs in successfully
- **THEN** the frontend calls signIn, obtains the `auth-identity-token`, exchanges it for a `rezics-session-token`, and stores both tokens in localStorage

#### Scenario: Registration acquires both tokens

- **WHEN** a user registers successfully
- **THEN** the frontend calls signUp (auth provisions server user via hook), obtains the `auth-identity-token`, exchanges it for a `rezics-session-token`, and stores both tokens in localStorage

#### Scenario: Exchange failure after login shows error

- **WHEN** login succeeds but the `POST /session/exchange` call fails
- **THEN** the frontend shows an error and the user is not considered authenticated (no `rezics-session-token`)

### Requirement: Pages are thin consumers of auth state

Pages SHALL trigger Better Auth actions and read auth state. Pages SHALL NOT directly call `hydrateAuthSessionState()`, `ensureAuthIdentityToken()`, or `POST /session/exchange`. Auth orchestration is handled by the login/register handlers and `AuthProvider`.

#### Scenario: Page reads auth state without orchestrating

- **WHEN** a page component renders
- **THEN** it reads `capabilityLevel` and `identity` from `authSessionStore` / `useAuth()` and does not initiate token flows

### Requirement: Post-auth navigation supports redirect targets with readiness overrides

`resolvePostAuthDestination()` SHALL accept optional redirect target, apply readiness-based priority overrides (onboarding/verification required override redirect target).

#### Scenario: Verification required overrides redirect

- **WHEN** a user completes login with `needsVerification: true` and a redirect target of `/shelves`
- **THEN** navigation goes to the verification page, not `/shelves`
