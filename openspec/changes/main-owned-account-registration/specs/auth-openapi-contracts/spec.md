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

### Requirement: Auth contracts cover cancel registration support
Auth contracts SHALL include internal or public-through-main response shapes needed for canceling or deleting a temporary registration account.

#### Scenario: Cancel registration succeeds
- **WHEN** main calls auth to cancel a temporary account
- **THEN** auth SHALL return a typed success response
- **AND** sessions for the canceled account SHALL be invalidated

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
