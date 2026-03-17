## MODIFIED Requirements

### Requirement: Frontend tracks identity, auth context, and main-server session separately

The frontend SHALL treat `auth_identity_token`, `auth_context_token`, and the main-server session token as separate token contexts with distinct purposes and lifecycle steps.

#### Scenario: Frontend fetches auth context before ensure

- WHEN the frontend has an authenticated auth session
- THEN it SHALL request `auth_context_token` through the auth API before attempting first-time ensure
- AND it SHALL keep `auth_context_token` distinct from `auth_identity_token`

#### Scenario: Frontend uses auth identity as login proof for ensure

- WHEN the frontend calls `GET /users/ensure`
- THEN it SHALL present `auth_identity_token` as the login-proof token
- AND it SHALL present `auth_context_token` when first-time user creation requires auth-owned profile context

#### Scenario: Frontend requests main-server session after ensure

- WHEN `GET /users/ensure` has completed successfully
- THEN the frontend SHALL obtain the main-server JWT through `/session/token`
- AND it SHALL not assume the ensure response also returns the main-server session token

### Requirement: Frontend parses JWT payloads locally

Frontend packages SHALL decode JWT payloads locally when they need token claims and SHALL NOT depend on `/jwt-payload`.

#### Scenario: Client reads claims without backend payload endpoint

- WHEN frontend code needs token claims such as verification state, name, or slug
- THEN it SHALL parse the JWT payload locally
- AND it SHALL NOT call `/jwt-payload`

### Requirement: Logout and invalidation clear all token contexts

Logout and invalid-token handling SHALL clear the auth identity token, auth context token, and main-server session token together with their derived state.

#### Scenario: Logout clears all token state

- WHEN the user logs out
- THEN the frontend SHALL clear `auth_identity_token`
- AND it SHALL clear `auth_context_token`
- AND it SHALL clear the main-server session token
- AND it SHALL reset any derived onboarding or authorization state built from those tokens
