## MODIFIED Requirements

### Requirement: Authentication state and profile state are managed by separate stores

Frontend SHALL maintain `authSessionStore` as the sole source of truth for authentication state. `authSessionStore` SHALL derive `capabilityLevel` from the presence and validity of the `rezics-session-token` (not `auth-identity-token`): `anonymous` (no valid token) or `member` (valid `rezics-session-token` exists). The `needsVerification` flag SHALL be derived from the `auth-identity-token`'s `email_verified` claim. The store SHALL NOT call `getAuthSessionState()` — session state is derived locally from token claims.

#### Scenario: Member capability derived from rezics-session-token

- **WHEN** a valid `rezics-session-token` exists in localStorage
- **THEN** `authSessionStore.capabilityLevel` is `"member"` and `hasAuthSession` is `true`

#### Scenario: Anonymous state when no rezics-session-token

- **WHEN** no valid `rezics-session-token` exists in localStorage
- **THEN** `authSessionStore.capabilityLevel` is `"anonymous"` regardless of `auth-identity-token` presence

#### Scenario: Needs verification derived from auth-identity-token claims

- **WHEN** the `auth-identity-token` JWT contains `email_verified: false`
- **THEN** `authSessionStore.needsVerification` is `true`

### Requirement: useAuth hook reads from separated stores

`useAuth()` hook SHALL read authentication state from `authSessionStore`. User identity (unitId, role) SHALL be parsed from the `rezics-session-token` claims. Profile data SHALL come from `userProfileStore` or API queries, not from token claims.

#### Scenario: useAuth returns identity from rezics-session-token

- **WHEN** `useAuth()` is called with a valid `rezics-session-token` in storage
- **THEN** the returned identity includes `unitId` and `role` parsed from the token's JWT claims
