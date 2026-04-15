### Requirement: Single registration completion page at /complete-registration

The app SHALL provide a single page at `/complete-registration` that combines both registration steps: identity setup (Step 1) and email verification (Step 2). The page SHALL detect which steps are complete and render accordingly.

#### Scenario: Both steps incomplete

- **WHEN** a user with no `UserProfile` and `emailVerified: false` visits the page
- **THEN** both Step 1 (identity) and Step 2 (email verification) sections SHALL be displayed
- **AND** both SHALL be interactive and submittable independently

#### Scenario: Only Step 1 complete

- **WHEN** a user with a `UserProfile` but `emailVerified: false` visits the page
- **THEN** Step 1 SHALL show as completed (displaying the locked slug)
- **AND** Step 2 (email verification) SHALL be interactive

#### Scenario: Only Step 2 complete

- **WHEN** a user with `emailVerified: true` but no `UserProfile` visits the page
- **THEN** Step 1 (identity) SHALL be interactive
- **AND** Step 2 SHALL show as completed (email verified)

#### Scenario: Both steps complete

- **WHEN** a fully registered user visits `/complete-registration`
- **THEN** the page SHALL redirect to `/` (or show a "registration complete" state)

#### Scenario: User navigates away and returns

- **WHEN** a user completes Step 1, navigates to browse the app, and later returns to `/complete-registration`
- **THEN** Step 1 SHALL show as completed with the locked slug
- **AND** Step 2 SHALL be in whatever state it was left in

### Requirement: Step 1 UI -- identity form

The identity step SHALL display a form with username and slug fields. The slug field SHALL provide real-time availability feedback (debounced check against the auth server). The form SHALL have a "Confirm" submit button.

#### Scenario: User fills and submits identity form

- **WHEN** a user enters a valid username and an available slug, then clicks "Confirm"
- **THEN** the form SHALL submit to the auth service identity endpoint
- **AND** on success, Step 1 SHALL transition to the completed state showing the locked slug

#### Scenario: Slug conflict on submit

- **WHEN** a user submits a slug that was available during typing but was taken between check and submit
- **THEN** the form SHALL display the conflict error from the server
- **AND** the user SHALL be able to pick a different slug

#### Scenario: Real-time slug validation feedback

- **WHEN** a user types in the slug field
- **THEN** the UI SHALL show format validation errors immediately (client-side)
- **AND** the UI SHALL check availability with a debounced server call after format is valid
- **AND** availability status SHALL be displayed inline (available/taken)

### Requirement: Step 2 UI -- email verification

The email verification step SHALL display the user's email and provide OTP verification controls (send code, enter code). For OAuth users with a trusted provider email, Step 2 SHALL show the email as already verified.

#### Scenario: Email/password user verifies email

- **WHEN** an email/password user interacts with Step 2
- **THEN** the Turnstile challenge SHALL be presented first
- **AND** after passing Turnstile, the user SHALL be able to request an OTP code
- **AND** after entering the correct code, Step 2 SHALL transition to the completed state

#### Scenario: OAuth user with trusted email sees verified state

- **WHEN** an OAuth user with `emailVerified: true` (from a trusted provider) views Step 2
- **THEN** the email SHALL be displayed with a "verified by [Provider]" indicator
- **AND** an "Edit" button SHALL be available

#### Scenario: OAuth user edits verified email

- **WHEN** an OAuth user clicks "Edit" on their verified email
- **THEN** a confirmation dialog SHALL appear warning that editing requires re-verification
- **AND** if the user confirms, the email field SHALL become editable
- **AND** submitting a new email SHALL trigger the standard OTP verification flow
- **AND** the account SHALL remain linked to the OAuth provider regardless

### Requirement: Completed step displays locked state

When a step is completed, the UI SHALL display it in a non-editable, visually distinct "completed" state showing the confirmed values.

#### Scenario: Completed identity step display

- **WHEN** Step 1 is complete
- **THEN** the username and slug SHALL be displayed as read-only
- **AND** a visual indicator (e.g., checkmark) SHALL mark the step as done

#### Scenario: Completed email step display

- **WHEN** Step 2 is complete
- **THEN** the verified email SHALL be displayed as read-only
- **AND** a visual indicator SHALL mark the step as done

### Requirement: Registration completion triggers provisioning

When the step that completes last is submitted successfully, the frontend SHALL trigger a session exchange to provision the user on the main server. After successful provisioning, the auth session state SHALL be refreshed and the user transitions to fully registered.

#### Scenario: Step 2 completes last, triggering provisioning

- **WHEN** a user with a `UserProfile` verifies their email (completing both steps)
- **THEN** the frontend SHALL call `exchangeForSessionToken()` to trigger provisioning
- **AND** the auth session state SHALL refresh to reflect `registrationComplete: true`

#### Scenario: Step 1 completes last, provisioning handled server-side

- **WHEN** a user with `emailVerified: true` confirms their identity (completing both steps)
- **THEN** the auth server SHALL provision the user during the identity endpoint handler
- **AND** the frontend SHALL refresh auth session state to reflect completion

### Requirement: Old routes redirect to /complete-registration

The `/verify-email` and `/onboarding` routes SHALL redirect to `/complete-registration` to preserve any existing bookmarks or links.

#### Scenario: User visits /verify-email

- **WHEN** a user navigates to `/verify-email`
- **THEN** they SHALL be redirected to `/complete-registration`

#### Scenario: User visits /onboarding

- **WHEN** a user navigates to `/onboarding`
- **THEN** they SHALL be redirected to `/complete-registration`
