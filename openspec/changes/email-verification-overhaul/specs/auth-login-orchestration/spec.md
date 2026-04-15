## MODIFIED Requirements

### Requirement: Post-auth navigation supports redirect targets with readiness overrides

`resolvePostAuthDestination()` SHALL accept optional redirect target, apply readiness-based priority overrides (onboarding/verification required override redirect target). Navigation to `/verify-email` for unverified users is a soft redirect — the user is not locked and can navigate away freely.

#### Scenario: Verification required performs soft redirect

- **WHEN** a user completes login with `needsVerification: true` and a redirect target of `/shelves`
- **THEN** navigation goes to the verification page initially, but the user can navigate to `/shelves` or any other page at any time

#### Scenario: Verified user follows redirect target

- **WHEN** a user completes login with `needsVerification: false` and a redirect target of `/shelves`
- **THEN** navigation goes to `/shelves` as expected
