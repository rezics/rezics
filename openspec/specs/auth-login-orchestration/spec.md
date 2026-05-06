### Requirement: Post-auth navigation supports redirect targets with readiness overrides

`resolvePostAuthDestination()` SHALL accept optional redirect target and apply readiness-based priority overrides after main has completed login orchestration through the public `/auth/*` boundary. If the user's registration is incomplete (`registrationComplete: false`, meaning either UserProfile is missing OR email is unverified), navigation SHALL go to `/complete-registration` as a soft redirect -- the user is not locked and can navigate away freely.

Login, social callback, and post-auth refresh flows SHALL complete through main so main can provision or verify main user readiness and refresh the `rezics-session-token` httpOnly cookie without requiring auth to notify main.

#### Scenario: Incomplete registration performs soft redirect

- **WHEN** a user completes login through main and registration is incomplete (missing identity or email verification)
- **THEN** navigation SHALL go to `/complete-registration` initially
- **AND** the user SHALL be able to navigate to any other page at any time

#### Scenario: Fully registered user follows redirect target

- **WHEN** a user completes login through main with registration complete and a redirect target of `/shelves`
- **THEN** navigation SHALL go to `/shelves` as expected

#### Scenario: Login completion refreshes main session through main

- **WHEN** auth callback or sign-in completes with a valid auth session cookie
- **THEN** main SHALL complete main readiness checks and refresh the `rezics-session-token` cookie
- **AND** auth SHALL NOT call back into main as a separate service notification
