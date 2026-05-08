## ADDED Requirements

### Requirement: Onboarding flow does not depend on AUTH_SESSION JWT in browser

The main app's onboarding/registration flow SHALL NOT decode, store, refresh, or otherwise depend on a browser-held `auth-session-token` JWT. The browser interacts with auth state exclusively through:
- The auth session httpOnly cookie (set by auth, opaque to the browser).
- The readable `rezics-auth-presence` hint cookie (presence-only, no claims).
- Main-aware session-state queries through main (`GET /auth/get-session-state`).

The onboarding step routing (anonymous → verify-email → setup-account → complete) SHALL be derived from the main-aware session state response and the readiness predicate `slug !== null`, not from claims of any browser-held JWT.

#### Scenario: Onboarding does not store JWT in localStorage

- **WHEN** the main app's onboarding flow runs
- **THEN** it SHALL NOT write any `auth-session-token` (or equivalent) to localStorage
- **AND** it SHALL NOT read any `auth-session-token` from localStorage

#### Scenario: Stage routing uses server-derived state

- **WHEN** the main app needs to decide between verify-email and setup-account
- **THEN** it SHALL consult the main-aware session-state response from main
- **AND** it SHALL NOT decode an `auth-session-token` JWT to read `email_verified` or `slug` claims
