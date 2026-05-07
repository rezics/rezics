## ADDED Requirements

### Requirement: Auth does not provision main users
The auth service SHALL NOT create or provision main `User` records from auth hooks, email verification handlers, `UserProfile`, provider callbacks, or auth session JWT exchange.

#### Scenario: Email verification succeeds
- **WHEN** an auth user verifies email
- **THEN** auth SHALL update auth-owned verification/session state
- **AND** auth SHALL NOT call the main user provisioning endpoint

#### Scenario: Social sign-up succeeds
- **WHEN** a user completes registration through an external provider
- **THEN** auth SHALL create or link auth-owned provider account records
- **AND** auth SHALL NOT create a main `User`

## REMOVED Requirements

### Requirement: Verify-email middleware provisions deferred users
**Reason**: Main user creation now requires main-owned account setup with a user-chosen slug. Auth verification handlers do not have product authority to create the main user.
**Migration**: After verification, the frontend SHALL call the main account setup endpoint to create the user.

### Requirement: Shared provisioning utility
**Reason**: Auth-to-main provisioning is removed from registration. A shared auth provisioning utility would preserve the wrong ownership direction.
**Migration**: Remove auth usage of `provisionUserOnServer`; main owns account setup and creation.

### Requirement: Server internal provisioning endpoint
**Reason**: Registration no longer uses auth-originated internal provisioning. Main user creation occurs through a main-owned public account setup route after auth state validation.
**Migration**: Remove or restrict `/internal/users/provision` to non-registration internal tooling if still needed; registration SHALL NOT call it.
