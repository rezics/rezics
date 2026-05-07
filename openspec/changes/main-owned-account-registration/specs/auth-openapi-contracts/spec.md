## ADDED Requirements

### Requirement: Auth exposes pending registration state
Auth-facing session state contracts SHALL expose enough normalized state for the frontend and main to distinguish an anonymous user, a pending unverified auth user, a verified auth-only user without main account setup, and a fully registered main user.

#### Scenario: Pending user session state is requested
- **WHEN** a browser with an unverified temporary auth session requests session state
- **THEN** the response SHALL indicate pending registration and unverified email
- **AND** it SHALL NOT imply that a main member session can be acquired

#### Scenario: Verified auth-only session state is requested
- **WHEN** a browser with verified email but no main user requests session state
- **THEN** the response SHALL indicate that main account setup is required

### Requirement: Auth session state handles missing sessions without server errors
Auth-facing session state endpoints SHALL return a typed unauthorized response when no valid auth session exists. They SHALL NOT throw internal server errors for `null` or malformed upstream session payloads.

#### Scenario: Missing auth session is requested
- **WHEN** a browser without a valid auth session requests session state
- **THEN** auth SHALL return an unauthorized typed error
- **AND** the response SHALL NOT be a 500

### Requirement: Session-state checks avoid unrelated JWT signing work
Auth-facing session-state requests SHALL read the existing opaque browser session and pending-registration metadata without issuing a new auth JWT header or refreshing the session as a side effect.

#### Scenario: Pending session state is probed
- **WHEN** main or the frontend requests normalized session state
- **THEN** auth SHALL not perform JWT/JWKS signing-key work merely to answer the readiness check
- **AND** session-state latency SHALL be dominated by session/user/account reads, not signing-key bootstrap

### Requirement: Verification contracts expose delivery failures
Verification email and OTP contracts SHALL expose recoverable error information for delivery failure, Turnstile failure, cooldown, invalid OTP, expired OTP, and already-verified states.

#### Scenario: Verification email cannot be delivered
- **WHEN** the mailer fails to send a verification message
- **THEN** the API response SHALL expose a typed error that frontend can render
- **AND** the frontend SHALL not need to parse plain text errors

## REMOVED Requirements

### Requirement: Organization schemas
**Reason**: Auth organization is removed from the product-facing auth surface.
**Migration**: Remove organization request/response schemas from auth OpenAPI exports unless retained only for private migration tooling.

### Requirement: UserProfile-backed identity schemas
**Reason**: Auth no longer owns Rezics slug/profile identity.
**Migration**: Move slug setup and availability contracts to main-owned account setup APIs.
