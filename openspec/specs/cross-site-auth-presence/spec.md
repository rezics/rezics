# cross-site-auth-presence Specification

## Purpose
TBD - created by archiving change add-open-session-cookie-consent. Update Purpose after archive.
## Requirements
### Requirement: Auth backend exposes a JS-readable cross-site auth presence signal
The auth backend SHALL maintain a root-domain, JavaScript-readable presence signal separate from bearer credentials so Rezics browser clients can detect whether a shared auth session likely exists without requesting a JWT. The signal SHALL contain no access token, refresh token, or other bearer-secret material.

#### Scenario: Signed-in browser receives presence signal
- **WHEN** a browser successfully completes sign-in or token bootstrap through `package/auth`
- **THEN** the auth backend SHALL set or refresh the cross-site auth presence signal for the shared root domain
- **AND** JavaScript running on another Rezics site under that root domain SHALL be able to read the signal

#### Scenario: Signed-out browser loses presence signal
- **WHEN** a browser signs out from the auth backend
- **THEN** the auth backend SHALL clear the cross-site auth presence signal

### Requirement: Frontend auth bootstrap is gated by the presence signal
Shared frontend auth infrastructure SHALL consult the cross-site auth presence signal before attempting passive JWT bootstrap or automatic refresh. When the signal is absent, frontend code SHALL skip passive token acquisition and SHALL keep the user in an anonymous state until an explicit auth action occurs.

#### Scenario: No presence skips passive token bootstrap
- **WHEN** a Rezics site loads with no stored business JWT and no cross-site auth presence signal
- **THEN** shared frontend auth code SHALL NOT call the auth token endpoint merely to probe login state
- **AND** the user SHALL remain anonymous until they explicitly sign in or a later presence check succeeds

#### Scenario: Presence allows token bootstrap
- **WHEN** a Rezics site loads with no stored business JWT and the cross-site auth presence signal is present
- **THEN** shared frontend auth code MAY request a JWT or normalized session state from the auth backend
- **AND** successful token acquisition SHALL transition the user into the authenticated flow used today

### Requirement: Failed bootstrap from stale presence degrades safely
If the cross-site auth presence signal exists but the auth backend no longer accepts the underlying session, shared frontend auth code SHALL fail closed, avoid repeated refresh loops, and clear any stale authenticated client state.

#### Scenario: Stale presence does not cause retry storm
- **WHEN** the cross-site auth presence signal is present but JWT bootstrap or session hydration fails because the server no longer recognizes the session
- **THEN** the frontend SHALL clear any stored business JWT
- **AND** the frontend SHALL NOT continuously retry token bootstrap in a tight loop
- **AND** the user SHALL be treated as anonymous until another successful auth event occurs

#### Scenario: Protected API retry respects missing presence
- **WHEN** a protected API request returns `401 Unauthorized` and the cross-site auth presence signal is absent
- **THEN** shared API retry code SHALL NOT attempt automatic JWT refresh
- **AND** the original request SHALL fail with an unauthorized result

