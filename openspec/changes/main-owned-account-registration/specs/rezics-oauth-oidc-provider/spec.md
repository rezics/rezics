## ADDED Requirements

### Requirement: OAuth protocol storage remains auth-owned
Auth SHALL continue to own OAuth/OIDC protocol behavior and storage required for authorization, token exchange, userinfo, revoke, consent, and client credentials.

#### Scenario: OAuth client exchanges authorization code
- **WHEN** a valid OAuth client posts an authorization code to `/auth/oauth/token`
- **THEN** auth SHALL process the token exchange according to OAuth/OIDC rules
- **AND** main SHALL NOT reimplement grant validation

### Requirement: OAuth app product ownership lives in main
Any Rezics product workflow for requesting, reviewing, owning, or managing third-party OAuth applications SHALL live in main. Auth SHALL receive only the minimal protocol client data needed to execute OAuth/OIDC flows.

#### Scenario: Developer applies for OAuth app
- **WHEN** a developer creates or requests an OAuth application in the Rezics UI
- **THEN** main SHALL own the product record, owner relationship, review state, and authorization policy
- **AND** auth SHALL only store or receive protocol client fields required for OAuth operation

#### Scenario: OAuth app ownership changes
- **WHEN** an app owner or team membership changes
- **THEN** main SHALL update product ownership state
- **AND** auth protocol records SHALL be synchronized only as needed for client validity

### Requirement: Auth organization is not used for OAuth app ownership
The system SHALL NOT use better-auth organization membership as the ownership or authorization model for Rezics OAuth applications.

#### Scenario: OAuth app management is authorized
- **WHEN** a user attempts to manage an OAuth application
- **THEN** main SHALL authorize the action using main-owned user and developer ownership state
- **AND** auth organization membership SHALL NOT grant or deny the action
