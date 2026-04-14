## MODIFIED Requirements

### Requirement: Auth afterSignUp hook provisions server user synchronously

The auth service SHALL register a `user.create.after` lifecycle hook with better-auth that calls the server's internal provisioning endpoint during user registration. The hook SHALL check `user.emailVerified` before provisioning: if `emailVerified` is `false`, the hook SHALL skip provisioning and return early. If `emailVerified` is `true` (e.g., social/OAuth sign-ups), the hook SHALL send `{ unitId, slug, name }` derived from the newly created auth user. If the provisioning call fails for a verified user, registration SHALL fail and the error SHALL propagate to the client.

#### Scenario: Social sign-up with verified email provisions immediately

- **WHEN** a user completes registration via a social/OAuth provider with a verified email
- **THEN** the `user.create.after` hook calls `POST <server>/internal/users/provision` with the user's `unitId`, `slug`, and `name`, and the server creates the user record before the registration response is returned to the client

#### Scenario: Email/password sign-up skips provisioning

- **WHEN** a user completes email/password registration with an unverified email
- **THEN** the `user.create.after` hook detects `emailVerified: false` and returns without calling the provisioning endpoint

#### Scenario: Server provisioning failure fails registration

- **WHEN** the `user.create.after` hook's call to the server provisioning endpoint fails (network error, server error) for a verified user
- **THEN** the registration response returns an error status to the client, and the user is informed registration did not complete

## ADDED Requirements

### Requirement: Verify-email middleware provisions deferred users

The auth request handler SHALL detect successful email verification responses and trigger user provisioning. After `auth.handler()` returns a successful response for the `/verify-email` path, the handler SHALL clone the response, read the user object from the body, and call the provisioning function with `{ unitId, slug, name }`.

#### Scenario: Email verification triggers deferred provisioning

- **WHEN** a user clicks the email verification link and the auth service returns a successful response with a user object
- **THEN** the handler calls `provisionUserOnServer()` with the verified user's `id`, `name`, and derived slug, and the server creates the user record

#### Scenario: Provisioning failure does not block verification response

- **WHEN** the verify-email response is successful but the provisioning call fails
- **THEN** the verification response is still returned to the client, and the provisioning error is logged

#### Scenario: Verification response without user object skips provisioning

- **WHEN** the verify-email response is successful but does not contain a user object in the body
- **THEN** provisioning is skipped and the response is returned as-is

### Requirement: Shared provisioning utility

The provisioning fetch logic SHALL be extracted into a shared function (`provisionUserOnServer`) within `@rezics/auth`. Both the `user.create.after` hook and the verify-email middleware SHALL use this function. The function SHALL accept `{ unitId, slug, name }` and call `POST <server>/internal/users/provision` with the `x-internal-secret` header.

#### Scenario: Both provisioning sites use the shared function

- **WHEN** provisioning is triggered from either the database hook or the verify-email middleware
- **THEN** both call `provisionUserOnServer()` with the same parameters and behavior
