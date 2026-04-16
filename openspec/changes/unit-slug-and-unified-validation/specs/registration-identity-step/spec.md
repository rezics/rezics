## MODIFIED Requirements

### Requirement: User explicitly sets username and slug during registration

The auth service SHALL expose an endpoint for authenticated users to submit their chosen username and slug. The endpoint SHALL validate the slug using `validateSlug` imported from `@rezics/contract` (format: lowercase `[a-z0-9-]`, length 6–36, no leading/trailing/consecutive hyphens, no reserved words from the platform-wide reserved list) and uniqueness (against `UserProfile.slug` `@unique` constraint in auth DB). On success, the endpoint SHALL create a `UserProfile` row with the user's `userId` and chosen `slug`, and update `User.name` with the chosen username.

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

The auth service SHALL expose an endpoint for authenticated users to check if a slug is available before submitting. The endpoint SHALL validate format using `validateSlug` from `@rezics/contract` and check uniqueness, returning the result without creating any records.

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
- **AND** uniqueness and format validation (via `@rezics/contract`) SHALL still apply
