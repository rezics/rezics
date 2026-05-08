## MODIFIED Requirements

### Requirement: AuthProvider accepts a configurable token array

AuthProvider SHALL accept a `tokens` parameter specifying which token names to manage. The default configuration SHALL include exactly one token: `REZICS_SESSION`. There SHALL be no `AUTH_SESSION` entry — auth session validity is conveyed by the auth session httpOnly cookie, which the browser does not parse. AuthProvider SHALL be exported from `@rezics/api`.

#### Scenario: AuthProvider managed one token by default

- **WHEN** AuthProvider initializes with default configuration
- **THEN** it manages exactly one token: `REZICS_SESSION`, refreshed via the cookie boundary

#### Scenario: AuthProvider imported from @rezics/api

- **WHEN** an app needs the auth provider
- **THEN** it imports `AuthProvider` from `@rezics/api`

### Requirement: AuthProvider refreshes tokens proactively before expiry

AuthProvider SHALL schedule `REZICS_SESSION` refresh before its JWT expiration with a configurable refresh buffer (default 60 seconds). Each refresh call SHALL hit `POST /auth/session/refresh` with credentials-included so the auth session cookie is forwarded. There is no separate `AUTH_SESSION` token to coordinate; auth session refresh is implicit in the cookie roundtrip.

#### Scenario: Proactive REZICS_SESSION refresh

- **WHEN** `REZICS_SESSION` is approaching expiry
- **THEN** AuthProvider calls `POST /auth/session/refresh` with credentials-included
- **AND** the response sets a fresh `rezics-session-token` httpOnly cookie

#### Scenario: Refresh fails when auth session has expired

- **WHEN** `POST /auth/session/refresh` returns 401 because the auth session cookie is invalid
- **THEN** AuthProvider transitions `REZICS_SESSION` to dormant
- **AND** the user is treated as anonymous

### Requirement: AuthProvider is stateless and side-effect free to consumers

AuthProvider SHALL NOT maintain Zustand/Jotai/React context state. Its sole observable effects SHALL be (a) issuing the cookie-boundary refresh call to keep the `rezics-session-token` cookie fresh and (b) optionally caching the latest token body for non-browser callers via a localStorage key, dispatching a storage event when it does so. Browser code SHALL NOT depend on the localStorage cache for cookie-authenticated requests.

#### Scenario: Cookie-only browser path

- **WHEN** AuthProvider runs in a normal browser environment
- **THEN** it relies on the `rezics-session-token` httpOnly cookie for authentication
- **AND** it SHALL NOT inject a localStorage bearer for browser API calls

### Requirement: AuthProvider reacts to failure type

AuthProvider SHALL distinguish between retryable failures (network errors, 5xx) and non-retryable failures (401, 403, 404). On non-retryable failure for `REZICS_SESSION` refresh, the user SHALL be transitioned to anonymous state (the auth session cookie is implicitly invalid).

#### Scenario: REZICS_SESSION non-retryable failure → anonymous

- **WHEN** `POST /auth/session/refresh` returns 401
- **THEN** AuthProvider sets `REZICS_SESSION` dormant
- **AND** the user must re-authenticate to obtain a new auth session cookie

### Requirement: AuthProvider recovers on visibility change

When the document becomes visible after being hidden, AuthProvider SHALL re-evaluate `REZICS_SESSION` freshness and refresh via the cookie boundary if expired or missing.

#### Scenario: Returning from background refreshes expired token

- **WHEN** the browser tab becomes visible and the cached `REZICS_SESSION` token has expired
- **THEN** AuthProvider calls `POST /auth/session/refresh` to obtain a new `rezics-session-token` cookie

### Requirement: AuthProvider does not perform user provisioning

AuthProvider SHALL NOT call any user-provisioning endpoint. Provisioning is the responsibility of the auth `afterSignUp` hook (when configured) and the cookie-boundary `materializeMainAccountFromAuth` flow. No frontend-side exchange guard SHALL be needed; `POST /auth/session/refresh` itself enforces verification and member-readiness checks server-side.

#### Scenario: AuthProvider skips provisioning

- **WHEN** AuthProvider refreshes `REZICS_SESSION` for a newly registered user
- **THEN** it SHALL NOT call any provisioning endpoint
- **AND** the cookie-boundary refresh response indicates whether the user is member-ready

### Requirement: authSessionStore hydrates permission from session token

When `authSessionStore` hydrates from a refreshed `REZICS_SESSION` token, it SHALL parse the token's `permission` claim and expose it as the `permission` field. It SHALL NOT derive or expose `capabilityLevel` from any other source. It SHALL NOT read the deprecated top-level `role` claim (which no longer exists).

#### Scenario: Store hydrates permission after token refresh

- **WHEN** AuthProvider's cookie refresh writes a new `REZICS_SESSION` representation
- **THEN** `authSessionStore` reads the token's `permission.role` and updates its `permission` field accordingly
