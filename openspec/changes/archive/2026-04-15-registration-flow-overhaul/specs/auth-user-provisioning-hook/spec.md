## MODIFIED Requirements

### Requirement: Auth afterSignUp hook provisions server user synchronously

The auth service SHALL register a `user.create.after` lifecycle hook with better-auth. The hook SHALL NOT provision users to the server regardless of `emailVerified` status. User provisioning is deferred until both registration steps are complete (UserProfile exists AND emailVerified is true), triggered by the registration-identity-step or email verification flow.

#### Scenario: Social sign-up with verified email does NOT provision immediately

- **WHEN** a user completes registration via a social/OAuth provider with a verified email
- **THEN** the `user.create.after` hook SHALL NOT call the provisioning endpoint
- **AND** the user SHALL remain unprovisioned on the main server until they complete Step 1 (identity confirmation)

#### Scenario: Email/password sign-up skips provisioning

- **WHEN** a user completes email/password registration with an unverified email
- **THEN** the `user.create.after` hook SHALL NOT call the provisioning endpoint

### Requirement: Verify-email middleware provisions deferred users

The auth request handler SHALL detect successful email verification responses and trigger user provisioning only if the user also has a `UserProfile` (identity step complete). After `auth.handler()` returns a successful response for the `/verify-email` path, the handler SHALL check if a `UserProfile` exists for the user. If both conditions are met (email verified AND UserProfile exists), it SHALL call `provisionUserOnServer()` with `{ unitId, slug, name }` using the slug from `UserProfile`.

#### Scenario: Email verification triggers provisioning when identity already set

- **WHEN** a user who has already completed Step 1 (UserProfile exists) verifies their email
- **THEN** the handler SHALL call `provisionUserOnServer()` with the verified user's `id`, `name`, and slug from `UserProfile`

#### Scenario: Email verification without identity step skips provisioning

- **WHEN** a user who has NOT completed Step 1 (no UserProfile) verifies their email
- **THEN** provisioning SHALL NOT fire
- **AND** provisioning SHALL be deferred until Step 1 is completed

#### Scenario: Provisioning failure does not block verification response

- **WHEN** the verify-email response is successful but the provisioning call fails
- **THEN** the verification response SHALL still be returned to the client
- **AND** the provisioning error SHALL be logged

### Requirement: Shared provisioning utility

The provisioning fetch logic SHALL be extracted into a shared function (`provisionUserOnServer`) within `@rezics/auth`. The verify-email middleware and the identity-step endpoint SHALL use this function. The function SHALL accept `{ unitId, slug, name }` and call `POST <server>/internal/users/provision` with the `x-internal-secret` header.

#### Scenario: Both provisioning sites use the shared function

- **WHEN** provisioning is triggered from either the identity-step endpoint or the verify-email middleware
- **THEN** both call `provisionUserOnServer()` with the same parameters and behavior

## REMOVED Requirements

### Requirement: Server provisioning failure fails registration

**Reason:** Provisioning no longer happens during `user.create.after`. Registration (account creation) always succeeds. Provisioning is a separate step that happens after both registration steps complete, with exchange-auto-provision as a fallback.
**Migration:** Provisioning errors are logged but do not block registration. The exchange-auto-provision fallback handles missed provisioning.
