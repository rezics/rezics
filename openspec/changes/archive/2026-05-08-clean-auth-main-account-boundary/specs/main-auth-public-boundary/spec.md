## MODIFIED Requirements

### Requirement: Mixed auth and main workflows are split or orchestrated by main
Workflows that require both auth-owned and main-owned state SHALL be split into separate auth-domain and main-domain endpoints where practical. If a split is not practical, main SHALL orchestrate the workflow, perform main-owned readiness checks, and call auth internally with service context. Registration verification is auth-owned. Main account materialization and profile setup are main-owned. Pausing registration is not a mixed workflow and SHALL use sign-out.

#### Scenario: Registration verification remains auth-owned
- **WHEN** a registrant verifies email or another auth-owned registration factor
- **THEN** auth SHALL own the verification mutation
- **AND** main SHALL NOT create or update product user state during that verification mutation

#### Scenario: Main materializes user from verified auth facts
- **WHEN** account materialization requires verified auth state and main user creation
- **THEN** main SHALL validate auth state internally before creating main-owned data
- **AND** auth SHALL return only the verified registration facts main needs
- **AND** auth SHALL NOT create or provision the main user on its own

#### Scenario: Mixed workflow cannot be split
- **WHEN** a route must update main state and auth state in one user action
- **THEN** main SHALL authorize the main mutation before calling auth internally
- **AND** auth SHALL still enforce auth-domain policy for the auth-owned part

### Requirement: Main owns registration orchestration routes
Main SHALL expose public registration orchestration routes under the main-owned auth/account boundary for materializing the main user after verification and for completing profile setup. Pausing an incomplete registration SHALL use normal sign-out rather than a destructive registration endpoint.

#### Scenario: Main account materialization route is requested
- **WHEN** a verified auth-only registrant requests main user materialization
- **THEN** main SHALL validate the auth session through auth
- **AND** main SHALL create a minimal main `User` if no main user exists
- **AND** main SHALL issue `rezics-profile-setup-token`
- **AND** main SHALL NOT issue `rezics-session-token`

#### Scenario: Profile setup route is requested
- **WHEN** a materialized profile-setup user submits slug and optional profile data
- **THEN** main SHALL validate `rezics-profile-setup-token`
- **AND** main SHALL activate the user as member-ready if the submission is valid
- **AND** main SHALL issue `rezics-session-token`

#### Scenario: Pending registration pause is requested
- **WHEN** an auth-only registrant chooses to continue later
- **THEN** the frontend SHALL call the normal sign-out boundary
- **AND** main SHALL clear main session state if present
- **AND** auth SHALL invalidate only the current browser session, not the temporary auth account

## ADDED Requirements

### Requirement: Auth facts returned to main are minimal
Auth SHALL expose only the verified facts needed for main materialization, such as auth subject, verified login email, provider trust status, and future verified registration factors.

#### Scenario: Main requests verified registration facts
- **WHEN** main validates an auth session for materialization
- **THEN** auth SHALL return the stable auth subject and verified registration facts
- **AND** auth SHALL NOT return or require Rezics slug, display name, product permissions, shelves, realm membership, or main profile authority

