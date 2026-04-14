## MODIFIED Requirements

### Requirement: Server notifies auth on profile update

When a user updates profile fields (`name`, `slug`, `avatar`) via the server, the server SHALL send a best-effort notification to the auth service's internal sync endpoint. The server SHALL also update the Meilisearch users index using a partial update with only the changed fields instead of rebuilding the entire user document. The server operation SHALL succeed regardless of whether the notification or search sync succeeds.

#### Scenario: Profile update triggers partial Meilisearch sync

- **WHEN** a user updates their `name`, `slug`, or `avatar` via `PUT /users/me` (or equivalent server endpoint)
- **THEN** the server updates its own database
- **THEN** the server calls `patchUserFields(unitId, { name, avatar })` with only the changed fields
- **AND** sends a non-blocking notification to auth with the updated fields
- **AND** returns success to the client

#### Scenario: Profile update also triggers partial post sync

- **WHEN** a user updates their `name`, `slug`, or `avatar`
- **THEN** the server SHALL also call `patchPostsAuthor(userId, { authorName, authorSlug, authorAvatar })` to update denormalized author fields across all the user's posts using partial updates

#### Scenario: Auth notification failure does not affect server response

- **WHEN** the profile sync notification to auth fails (network error, auth unavailable)
- **THEN** the server still returns a successful response to the client; auth's copy of the profile remains stale until the next successful sync
