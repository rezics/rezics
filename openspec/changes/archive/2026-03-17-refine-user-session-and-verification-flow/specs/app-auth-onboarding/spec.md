## MODIFIED Requirements

### Requirement: Pending-verification UI is driven by auth context and separated session steps

The main app SHALL derive onboarding and pending-verification UI from `auth_context_token` claims together with the separated ensure/session flow.

#### Scenario: Pending-verification header uses auth context before business user exists

- WHEN the browser has `auth_identity_token` and `auth_context_token`
- AND the user is authenticated in auth but has not completed the full ensure or main-session bootstrap
- THEN `MainLayoutHeader` SHALL be able to render `PendingVerificationSection`
- AND that section SHALL use auth-owned fields such as avatar, name, slug, and verification status from `auth_context_token`

#### Scenario: Ready header requires ensured user and main-server session

- WHEN the user has completed the required ensure flow
- AND the frontend has obtained the main-server session token from `/session/token`
- THEN the main app SHALL render the ready authenticated header state instead of the pending-verification state

#### Scenario: Existing user can skip duplicate provisioning while preserving onboarding state

- WHEN `GET /users/ensure` returns that the user is already created
- THEN the frontend SHALL treat that as a successful ensure result
- AND it SHALL continue the bootstrap flow toward `/session/token` without trying to create the user again
