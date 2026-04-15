### Requirement: Post-auth navigation supports redirect targets with readiness overrides

`resolvePostAuthDestination()` SHALL accept optional redirect target, apply readiness-based priority overrides. If the user's registration is incomplete (`registrationComplete: false`, meaning either UserProfile is missing OR email is unverified), navigation SHALL go to `/complete-registration` as a soft redirect -- the user is not locked and can navigate away freely.

#### Scenario: Incomplete registration performs soft redirect

- **WHEN** a user completes login and registration is incomplete (missing identity or email verification)
- **THEN** navigation SHALL go to `/complete-registration` initially
- **AND** the user SHALL be able to navigate to any other page at any time

#### Scenario: Fully registered user follows redirect target

- **WHEN** a user completes login with registration complete and a redirect target of `/shelves`
- **THEN** navigation SHALL go to `/shelves` as expected
