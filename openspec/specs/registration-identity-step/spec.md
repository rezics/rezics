### Requirement: User explicitly sets username and slug during registration

The auth service SHALL expose an endpoint for authenticated users to submit their chosen username and slug. The endpoint SHALL validate the slug for format (using the same rules as `slugVerify` in the server: 6-32 chars, alphanumeric + hyphens, no leading/trailing/consecutive hyphens, no reserved words) and uniqueness (against `UserProfile.slug` `@unique` constraint in auth DB). On success, the endpoint SHALL create a `UserProfile` row with the user's `userId` and chosen `slug`, and update `User.name` with the chosen username.

#### Scenario: Successful identity submission creates UserProfile

- **WHEN** an authenticated user without a `UserProfile` submits a valid, unique slug and username
- **THEN** a `UserProfile` row SHALL be created with the user's `userId` and slug
- **AND** `User.name` SHALL be updated to the submitted username
- **AND** the response SHALL indicate success

#### Scenario: Duplicate slug returns conflict error

- **WHEN** an authenticated user submits a slug that already exists in another `UserProfile`
- **THEN** the endpoint SHALL return an error indicating the slug is taken
- **AND** no `UserProfile` SHALL be created

#### Scenario: Invalid slug format returns validation error

- **WHEN** an authenticated user submits a slug that violates format rules (too short, reserved word, invalid characters, etc.)
- **THEN** the endpoint SHALL return a validation error describing the issue
- **AND** no `UserProfile` SHALL be created

#### Scenario: User with existing UserProfile is rejected

- **WHEN** an authenticated user who already has a `UserProfile` attempts to submit identity again
- **THEN** the endpoint SHALL return an error indicating identity is already set
- **AND** the existing `UserProfile` SHALL NOT be modified

### Requirement: Slug availability check endpoint

The auth service SHALL expose an endpoint for authenticated users to check if a slug is available before submitting. The endpoint SHALL validate format and uniqueness, returning the result without creating any records.

#### Scenario: Available slug

- **WHEN** a user checks a slug that is valid and not taken
- **THEN** the endpoint SHALL return that the slug is available

#### Scenario: Taken slug

- **WHEN** a user checks a slug that already exists
- **THEN** the endpoint SHALL return that the slug is taken

#### Scenario: Invalid format slug

- **WHEN** a user checks a slug with invalid format
- **THEN** the endpoint SHALL return the format validation error

### Requirement: Slug is immutable after UserProfile creation

Once a `UserProfile` exists for a user, the slug field SHALL NOT be updatable by the user through any user-facing endpoint. Only users with an admin role SHALL be permitted to update another user's slug.

#### Scenario: Regular user attempts to change slug

- **WHEN** an authenticated non-admin user attempts to update their slug after `UserProfile` exists
- **THEN** the request SHALL be rejected with a forbidden error

#### Scenario: Admin updates a user's slug

- **WHEN** an admin user updates another user's slug
- **THEN** the slug SHALL be updated in the `UserProfile`
- **AND** uniqueness validation SHALL still apply

### Requirement: Provisioning triggers after identity step if email already verified

After successfully creating a `UserProfile` (Step 1 complete), the auth service SHALL check if the user's `emailVerified` is `true`. If both conditions are met (UserProfile exists AND emailVerified), the service SHALL call `provisionUserOnServer()` with `{ unitId, slug, name }`.

#### Scenario: Identity set after email already verified (OAuth typical path)

- **WHEN** an OAuth user with `emailVerified: true` completes Step 1 (UserProfile created)
- **THEN** provisioning SHALL fire immediately after UserProfile creation
- **AND** the user SHALL be fully registered

#### Scenario: Identity set before email verified (email/password typical path)

- **WHEN** an email/password user with `emailVerified: false` completes Step 1
- **THEN** provisioning SHALL NOT fire
- **AND** the user SHALL still need to complete Step 2

#### Scenario: Provisioning failure after identity step

- **WHEN** Step 1 completes and email is verified, but the provisioning call fails
- **THEN** the UserProfile creation SHALL still succeed (not rolled back)
- **AND** the error SHALL be logged
- **AND** the exchange-auto-provision fallback SHALL handle provisioning on next token exchange

### Requirement: OAuth pre-fills username and slug from provider data

When an OAuth user lands on the registration completion page without a `UserProfile`, the frontend SHALL pre-fill the username field with the `User.name` from the auth session and derive a slug suggestion from it (lowercased, spaces replaced with hyphens, invalid chars stripped). The fields SHALL be freely editable without any confirmation dialog.

#### Scenario: Google user sees pre-filled identity fields

- **WHEN** a new Google OAuth user views the identity step
- **THEN** the username field SHALL show the name from their Google account
- **AND** the slug field SHALL show a derived slug (e.g., "John Doe" -> "john-doe")
- **AND** both fields SHALL be editable without restriction

#### Scenario: Provider name produces invalid slug

- **WHEN** the derived slug from the provider name is invalid (too short, reserved, etc.)
- **THEN** the slug field SHALL be shown empty or with a best-effort suggestion
- **AND** the user SHALL be prompted to enter a valid slug
