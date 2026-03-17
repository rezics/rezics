## MODIFIED Requirements

### Requirement: Main-server session token is issued from a dedicated `/session/token` endpoint

The main server SHALL issue its JWT from a dedicated `/session/token` endpoint rather than from `GET /users/ensure`.

#### Scenario: Session token is minted after ensure has completed

- GIVEN a caller with a valid `auth_identity_token`
- AND the corresponding local business user has already been ensured
- WHEN the caller requests `/session/token`
- THEN the main server SHALL issue the main-server session token from that endpoint
- AND it SHALL keep session-token creation separate from `GET /users/ensure`

#### Scenario: Ensure never issues the session token

- GIVEN any caller invoking `GET /users/ensure`
- WHEN the ensure flow finishes, whether the user already existed or was newly created
- THEN the response SHALL NOT mint or return the main-server session token

### Requirement: Main-server session issuance stays offline from auth-server APIs

The main server SHALL decide whether it can issue its session token by verifying client-supplied tokens and local state. It SHALL NOT call auth-server APIs directly during `/session/token`.

#### Scenario: Session endpoint verifies client-supplied auth proof without server-to-server auth call

- GIVEN a caller requesting `/session/token`
- WHEN the main server evaluates whether it can issue the token
- THEN it SHALL rely on verified client-supplied tokens such as `auth_identity_token` and any required local user state
- AND it SHALL NOT perform a direct request to an auth-server session-state endpoint

### Requirement: `/jwt-payload` is disabled

The backend SHALL NOT expose `/jwt-payload` as part of the supported session flow.

#### Scenario: Client cannot rely on `/jwt-payload`

- WHEN a client needs claims from `auth_identity_token`, `auth_context_token`, or the main-server session token
- THEN it SHALL parse the payload locally
- AND the supported backend contract SHALL not require a `/jwt-payload` request
