## ADDED Requirements

### Requirement: Server notifies auth on profile update

When a user updates profile fields (`name`, `slug`, `avatar`) via the server, the server SHALL send a best-effort notification to the auth service's internal sync endpoint. The server operation SHALL succeed regardless of whether the notification succeeds.

#### Scenario: Profile update triggers auth notification

- **WHEN** a user updates their `name`, `slug`, or `avatar` via `PUT /users/me` (or equivalent server endpoint)
- **THEN** the server updates its own database, then sends a non-blocking notification to auth with the updated fields, and returns success to the client

#### Scenario: Auth notification failure does not affect server response

- **WHEN** the profile sync notification to auth fails (network error, auth unavailable)
- **THEN** the server still returns a successful response to the client; auth's copy of the profile remains stale until the next successful sync

### Requirement: Auth exposes internal profile sync endpoint

The auth service SHALL expose `POST /internal/users/sync` authenticated via `x-internal-secret` header. The endpoint SHALL accept `{ unitId, name?, slug?, avatar? }` and update the corresponding fields on the auth user record. Only provided fields SHALL be updated.

#### Scenario: Successful profile sync updates auth user

- **WHEN** the sync endpoint receives `{ unitId: "abc", name: "New Name" }`
- **THEN** the auth user record matching `unitId` has its `name` field updated to "New Name"

#### Scenario: Unknown unitId is ignored

- **WHEN** the sync endpoint receives a `unitId` that does not match any auth user
- **THEN** the endpoint returns success (no-op) without error

#### Scenario: Missing internal secret returns 403

- **WHEN** the sync endpoint receives a request without a valid `x-internal-secret` header
- **THEN** the endpoint returns status 403
