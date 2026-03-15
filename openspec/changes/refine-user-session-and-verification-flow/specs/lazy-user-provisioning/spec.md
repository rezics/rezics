## MODIFIED Requirements

### Requirement: `GET /users/ensure` only ensures the business user

When a valid `auth_identity_token` is presented to the main server, the server SHALL use `GET /users/ensure` only to confirm that the caller is logged in and that a business `User` record exists locally. The endpoint SHALL NOT contact auth-server APIs directly and SHALL NOT issue the main-server session token.

#### Scenario: Existing user returns an explicit already-created result

- GIVEN a caller with a valid `auth_identity_token`
- AND a `User` record for that caller already exists in the main-server database
- WHEN the caller requests `GET /users/ensure`
- THEN the main server SHALL verify `auth_identity_token` before the lookup
- AND it SHALL return a success result that explicitly indicates the user is already created
- AND it SHALL NOT create a duplicate user
- AND it SHALL NOT issue the main-server session token as part of the ensure response

#### Scenario: Missing user is created from verified auth context

- GIVEN a caller with a valid `auth_identity_token`
- AND no matching `User` record exists in the main-server database
- AND the caller also provides a valid `auth_context_token`
- WHEN the caller requests `GET /users/ensure`
- THEN the main server SHALL verify that the caller is logged in from `auth_identity_token`
- AND it SHALL verify `auth_context_token` before creating the local user
- AND it SHALL create the local `User` from verified auth-context claims such as id, slug, name, avatar, and verification-related fields needed by the business model
- AND it SHALL complete without calling an auth-server session-state endpoint

#### Scenario: Invalid auth context blocks first-time user creation

- GIVEN a caller with a valid `auth_identity_token`
- AND no matching `User` record exists in the main-server database
- AND the provided `auth_context_token` is missing, invalid, or does not pass verification
- WHEN the caller requests `GET /users/ensure`
- THEN the main server SHALL reject the ensure request
- AND it SHALL NOT create a local user record

### Requirement: Other endpoints do not provision the user implicitly

Only `GET /users/ensure` SHALL create a missing business user. Other authenticated endpoints SHALL treat a missing user as missing data rather than provisioning implicitly.

#### Scenario: Business read endpoint does not create missing user

- GIVEN a caller with a valid `auth_identity_token`
- AND no matching `User` record exists in the main-server database
- WHEN the caller requests another authenticated user endpoint before `GET /users/ensure`
- THEN the server SHALL NOT create a new `User` record as a side effect of that request
