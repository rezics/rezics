## MODIFIED Requirements

### Requirement: Authorization: Bearer always carries rezics-session-token

All API endpoints on the server (and auxiliary services) SHALL expect `Authorization: Bearer <rezics-session-token>`, with the following exception: endpoints under the `/token` prefix and the `/dispatch` prefix SHALL accept `Authorization: Bearer <api_token>` (API tokens with `api_` prefix). The `auth-identity-token` SHALL NOT be sent via the `Authorization` header. The `auth-identity-token` is transported exclusively via the `x-auth-identity-token` header to the exchange endpoint.

#### Scenario: Server rejects auth-identity-token in Authorization header

- **WHEN** a request sends an `auth-identity-token` JWT in `Authorization: Bearer` to a server API endpoint
- **THEN** verification fails (issuer mismatch: "rezics-auth" vs expected "rezics-server") and the server returns status 401

#### Scenario: Token-prefix endpoints accept API tokens

- **WHEN** a request sends `Authorization: Bearer api_xxx` to a `/token/*` or `/dispatch/*` endpoint
- **THEN** the endpoint authenticates via `tokenService.authenticateFromHeader()` using the API token

#### Scenario: Non-token endpoints reject API tokens

- **WHEN** a request sends `Authorization: Bearer api_xxx` to a regular API endpoint (e.g., `/book/*`)
- **THEN** the endpoint rejects the request because API tokens are not valid session JWTs
