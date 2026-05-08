## ADDED Requirements

### Requirement: Public auth boundary accepts only cookie credentials

The public main-auth boundary (`https://rezics.com/auth/*`) SHALL accept session credentials exclusively through the auth session httpOnly cookie. The boundary SHALL NOT accept, define, list in CORS `allowedHeaders`, or honor a header-based session JWT (`x-auth-session-token` or any equivalent). The legacy `POST /session/exchange` endpoint and its proxy SHALL NOT exist on the boundary.

#### Scenario: Header-based session JWT is rejected at the boundary

- **WHEN** a browser request to any `/auth/*` route includes an `x-auth-session-token` header
- **THEN** main SHALL ignore the header
- **AND** the header SHALL NOT appear in main's CORS `allowedHeaders` for either `package/server` or `package/auth`

#### Scenario: Cookie is the sole session-bearing credential

- **WHEN** the browser refreshes its main session via `POST /auth/session/refresh`
- **THEN** the request SHALL be authorized by the auth session httpOnly cookie alone
- **AND** main SHALL forward the cookie to auth internally for validation

#### Scenario: Legacy /session/exchange endpoint does not exist

- **WHEN** any client requests `/session/exchange` on the boundary
- **THEN** the response SHALL be 404 Not Found
- **AND** no compatibility shim, alias, or 410 Gone tombstone SHALL be present
