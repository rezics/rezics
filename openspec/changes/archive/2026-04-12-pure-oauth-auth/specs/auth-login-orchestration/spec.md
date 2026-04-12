## MODIFIED Requirements

### Requirement: Login flow performs one-shot business session establishment

The login handler SHALL perform a two-step authentication sequence after successful Better Auth authentication:

1. Sign in via Better Auth API (email/password or social provider)
2. Obtain access token via `ensureAuthIdentityToken()`

After completion, AuthProvider detects the token in localStorage and begins managing refresh. User provisioning on the business server happens automatically on the user's first API call (lazy provisioning) — the frontend does not orchestrate it.

#### Scenario: Email login completes two-step sequence

- **WHEN** a user signs in via email
- **THEN** the login handler SHALL call `authApi.signIn()` followed by `ensureAuthIdentityToken()`
- **AND** the access token SHALL be present in localStorage
- **AND** `authSessionStore` SHALL reflect `capabilityLevel: 'member'`

#### Scenario: Email registration completes two-step sequence

- **WHEN** a new user registers via email
- **THEN** the register handler SHALL call `authApi.signUp()` followed by `ensureAuthIdentityToken()`
- **AND** the access token SHALL be present in localStorage

#### Scenario: Returning OAuth user completes two-step sequence

- **WHEN** a previously provisioned OAuth user signs in
- **THEN** the login handler SHALL execute the two-step sequence
- **AND** no explicit user provisioning call SHALL be made by the frontend

## REMOVED Requirements

### Requirement: AUTH_CONTEXT is ephemeral

**Reason:** AUTH_CONTEXT is eliminated entirely. The access token now carries `name` in its claims, replacing the profile data that AUTH_CONTEXT conveyed. There is no ephemeral token to manage.

**Migration:** Remove `authApi.getContextToken()` calls. Remove `x-auth-context-token` header handling. Access token claims provide `name` and `slug` for provisioning.

### Requirement: Provisioning sequence is extracted as a reusable utility

**Reason:** `establishBusinessSession()` is eliminated. The provisioning sequence (context token → ensure → session token → hydrate) no longer exists. Login is signIn + getToken. User provisioning happens server-side on first API call.

**Migration:** Delete `establishBusinessSession()` from `handler.ts`. Login and register handlers call `ensureAuthIdentityToken()` directly after auth API calls.

## MODIFIED Requirements

### Requirement: Pages are thin consumers of auth state

Pages SHALL trigger Better Auth actions and read auth state for UI and navigation. Pages SHALL NOT directly call `hydrateAuthSessionState()` or `ensureAuthIdentityToken()`.

#### Scenario: LoginPage delegates to handler

- **WHEN** the user submits credentials on LoginPage
- **THEN** LoginPage SHALL call the login handler
- **AND** navigate based on `resolvePostAuthDestination()` using auth state
- **AND** it SHALL NOT call token acquisition functions directly

#### Scenario: VerifyEmailPage reads state only

- **WHEN** the user is on VerifyEmailPage and clicks "refresh status"
- **THEN** the page SHALL re-fetch the access token (which now reflects verification state via the absence of `email_verified: false`)
- **AND** if the new token lacks `email_verified: false`, navigate to the app

#### Scenario: OAuthOnboardingPage submits then navigates

- **WHEN** the user completes onboarding and auth registration is finished
- **THEN** the page SHALL call the login handler (signIn + getToken)
- **AND** navigate based on the result
- **AND** it SHALL NOT reconstruct any provisioning sequence inline

### Requirement: Post-auth navigation supports redirect targets with readiness overrides

`resolvePostAuthDestination()` SHALL accept an optional redirect target and apply readiness-based priority overrides. Readiness is derived from the access token claims and auth session state.

#### Scenario: Onboarding required overrides redirect target

- **WHEN** the user has `needsOnboarding = true` and a redirect target of `/books/123`
- **THEN** `resolvePostAuthDestination()` SHALL return `/onboarding`

#### Scenario: Verification required overrides redirect target

- **WHEN** the access token contains `email_verified: false` and a redirect target of `/books/123`
- **THEN** `resolvePostAuthDestination()` SHALL return `/verify-email`

#### Scenario: Ready user navigates to redirect target

- **WHEN** the user has a valid access token without `email_verified: false` and a redirect target of `/books/123`
- **THEN** `resolvePostAuthDestination()` SHALL return `/books/123`

#### Scenario: Ready user with no redirect target goes to home

- **WHEN** the user has a valid access token without `email_verified: false` and no redirect target
- **THEN** `resolvePostAuthDestination()` SHALL return `/`
