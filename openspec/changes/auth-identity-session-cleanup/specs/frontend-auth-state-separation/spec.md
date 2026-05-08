## ADDED Requirements

### Requirement: authSessionStore does not manage AUTH_SESSION token

`authSessionStore` SHALL NOT track, hydrate from, or expose an `AUTH_SESSION` JWT. Auth identity (`hasAuthIdentity`) SHALL be derived from the main-aware session-state response (which reflects the auth session cookie's validity) and the readable `rezics-auth-presence` hint cookie. Member capability (`hasMemberSession`) SHALL be derived from the presence and freshness of the `rezics-session-token` httpOnly cookie via main-side hydration. The store SHALL NOT decode any browser-held `auth-session-token` JWT.

#### Scenario: hasAuthIdentity comes from server-side state, not a JWT

- **WHEN** `authSessionStore` resolves `hasAuthIdentity`
- **THEN** it SHALL consult the main-aware session-state response
- **AND** it SHALL NOT decode an `auth-session-token` JWT

#### Scenario: registrationStage uses slug-presence semantics

- **WHEN** `authSessionStore` resolves `registrationStage`
- **THEN** the `setup-account` and `complete` distinction SHALL be derived from whether the main user's `slug` is non-null in the session-state response
- **AND** it SHALL NOT consult any `accountStatus` field
