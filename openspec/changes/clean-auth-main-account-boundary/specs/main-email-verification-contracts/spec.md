## ADDED Requirements

### Requirement: Main stores product email verification contracts
Main SHALL store product email verification state in a contract table keyed by `contractName`, `ownerId`, and `email`. The table SHALL support `user.email` and SHALL be extensible to future product email contracts such as `org.email`.

#### Scenario: User email verification starts
- **WHEN** a user requests a change to `server.User.email`
- **THEN** main SHALL create or update a verification contract for `contractName = "user.email"`, the user id, and the requested email
- **AND** main SHALL NOT overwrite `server.User.email` before verification completes

#### Scenario: Future organization email verification starts
- **WHEN** a future organization email field uses the verification flow
- **THEN** main SHALL use a distinct contract name such as `"org.email"`
- **AND** the verification record SHALL remain independent of the `User` table

### Requirement: Main writes only verified product emails to domain tables
Main SHALL write an email value into `server.User.email` or another product email field only after the corresponding email verification contract is verified.

#### Scenario: Verification succeeds
- **WHEN** a pending `user.email` verification contract is successfully verified
- **THEN** main SHALL write the verified email to `server.User.email`
- **AND** main SHALL record the verification completion on the contract record

#### Scenario: Verification is pending
- **WHEN** a `user.email` verification contract is pending
- **THEN** main SHALL keep the pending email out of `server.User.email`
- **AND** profile APIs SHALL continue returning the previous verified main email, if any

### Requirement: Auth login email verification is not copied into main user columns
Auth-owned login email verification facts SHALL NOT be copied into generic main `User` columns such as `emailVerifiedAt` or `emailVerificationSource`. If auth verified facts are used to initialize main email, the verified state SHALL be represented through the main email verification contract.

#### Scenario: Registration materializes main email from auth facts
- **WHEN** main creates a minimal user from verified auth registration facts
- **THEN** main SHALL set `server.User.email` from the verified auth email
- **AND** main SHALL create or mark a `user.email` verification contract with a source indicating the auth registration verification
- **AND** main SHALL NOT persist auth verification facts in generic `User` verification columns

### Requirement: Email verification responses are recoverable
Main email verification APIs SHALL expose typed errors for delivery failure, cooldown, invalid code, expired code, and already-verified states.

#### Scenario: Delivery fails
- **WHEN** the system cannot deliver a main product email verification message
- **THEN** the response SHALL include a typed recoverable error
- **AND** frontend code SHALL NOT need to parse plain text errors

### Requirement: Main email verification uses shared sender with main config
Main product email verification SHALL use `@rezics/email` sender utilities with config derived from main server env. Main SHALL NOT call auth as a generic email sender for product email verification.

#### Scenario: Main sends product email verification
- **WHEN** main needs to deliver a `user.email` verification message
- **THEN** main SHALL read its own configured SMTP and sender values
- **AND** main SHALL pass those values to `@rezics/email`
- **AND** auth login email delivery configuration SHALL NOT be required for the main product email send

