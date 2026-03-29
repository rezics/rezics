## ADDED Requirements

### Requirement: Login flow performs one-shot business session establishment

The login handler SHALL perform the complete first-time session establishment sequence after successful Better Auth authentication:

1. Obtain AUTH_IDENTITY via `ensureAuthIdentityToken()`
2. Fetch AUTH_CONTEXT in memory (not persisted) via `getContextToken()`
3. Provision user on business server via `ensure()` with AUTH_IDENTITY and AUTH_CONTEXT
4. Issue REZICS_SESSION via `issueSessionToken()` with AUTH_IDENTITY
5. Hydrate `authSessionStore` from `get-session-state`

After completion, AuthProvider detects tokens in localStorage and begins managing refresh.

#### Scenario: Email login completes full sequence

- **WHEN** a user signs in via email and is eligible for member access
- **THEN** the login handler SHALL execute the full provisioning sequence
- **AND** AUTH_IDENTITY and REZICS_SESSION SHALL be present in localStorage
- **AND** `authSessionStore` SHALL reflect `capabilityLevel: 'member'`

#### Scenario: Email registration completes full sequence

- **WHEN** a new user registers via email and the auth service does not require verification for this registration
- **THEN** the register handler SHALL execute the full provisioning sequence
- **AND** the user SHALL be provisioned on the business server

#### Scenario: Returning OAuth user completes full sequence

- **WHEN** a previously provisioned OAuth user signs in
- **THEN** the login handler SHALL execute the full sequence
- **AND** `ensure()` SHALL return `alreadyCreated: true`
- **AND** REZICS_SESSION SHALL be issued normally

### Requirement: AUTH_CONTEXT is ephemeral

AUTH_CONTEXT SHALL be fetched on-demand by the provisioning sequence and held in memory only. It SHALL NOT be persisted to localStorage or managed by AuthProvider.

#### Scenario: AUTH_CONTEXT not stored after provisioning

- **WHEN** the login flow completes user provisioning via `ensure()`
- **THEN** AUTH_CONTEXT SHALL NOT exist in localStorage
- **AND** AuthProvider SHALL NOT be configured to manage AUTH_CONTEXT

#### Scenario: AUTH_CONTEXT fetched fresh each provisioning

- **WHEN** the login flow needs to call `ensure()` for a new user
- **THEN** it SHALL fetch AUTH_CONTEXT from `GET /api/auth/context-token`
- **AND** pass it directly to the `ensure()` call without intermediate storage

### Requirement: Provisioning sequence is extracted as a reusable utility

The one-shot provisioning sequence SHALL be extracted as a single function (e.g., `establishBusinessSession()`) that can be called from multiple entry points without duplicating the sequence.

#### Scenario: Login handler uses shared utility

- **WHEN** `handler.login()` completes Better Auth sign-in
- **THEN** it SHALL call the shared provisioning utility
- **AND** it SHALL NOT inline the token acquisition and provisioning steps

#### Scenario: Onboarding completion uses shared utility

- **WHEN** OAuthOnboardingPage completes onboarding and auth registration is finished
- **THEN** it SHALL call the same shared provisioning utility
- **AND** the utility SHALL handle identity → context → ensure → session → hydrate

### Requirement: Pages are thin consumers of auth state

Pages SHALL trigger Better Auth actions and read auth state for UI and navigation. Pages SHALL NOT directly call `hydrateAuthSessionState()`, `ensureAuthIdentityToken()`, or `acquireMemberAccessIfReady()`.

#### Scenario: LoginPage delegates to handler

- **WHEN** the user submits credentials on LoginPage
- **THEN** LoginPage SHALL call the login handler
- **AND** navigate based on `resolvePostAuthDestination()` using auth state
- **AND** it SHALL NOT call token acquisition functions directly

#### Scenario: VerifyEmailPage reads state only

- **WHEN** the user is on VerifyEmailPage and clicks "refresh status"
- **THEN** the page SHALL re-fetch session state to check verification
- **AND** if verified, navigate to the app or trigger the provisioning utility
- **AND** it SHALL NOT call `ensureAuthIdentityToken()` or `acquireMemberAccessIfReady()` directly

#### Scenario: OAuthOnboardingPage submits then orchestrates

- **WHEN** the user completes onboarding and auth registration is finished
- **THEN** the page SHALL call the shared provisioning utility
- **AND** navigate based on the result
- **AND** it SHALL NOT reconstruct the token acquisition sequence inline

### Requirement: Post-auth navigation supports redirect targets with readiness overrides

`resolvePostAuthDestination()` SHALL accept an optional redirect target and apply readiness-based priority overrides.

#### Scenario: Onboarding required overrides redirect target

- **WHEN** the user has `needsOnboarding = true` and a redirect target of `/books/123`
- **THEN** `resolvePostAuthDestination()` SHALL return `/onboarding`

#### Scenario: Verification required overrides redirect target

- **WHEN** the user has `needsVerification = true` and a redirect target of `/books/123`
- **THEN** `resolvePostAuthDestination()` SHALL return `/verify-email`

#### Scenario: Ready user navigates to redirect target

- **WHEN** the user has `readyForApp = true` and a redirect target of `/books/123`
- **THEN** `resolvePostAuthDestination()` SHALL return `/books/123`

#### Scenario: Ready user with no redirect target goes to home

- **WHEN** the user has `readyForApp = true` and no redirect target
- **THEN** `resolvePostAuthDestination()` SHALL return `/`
