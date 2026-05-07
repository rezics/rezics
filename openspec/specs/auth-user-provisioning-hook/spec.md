# auth-user-provisioning-hook Specification

## Purpose

Defines auth's lifecycle behavior around user provisioning. After `main-owned-account-registration`, auth SHALL NOT provision main users from auth-side hooks, verification handlers, profile tables, or session exchange. Main is the sole authority for creating product users during account setup.

## Requirements

### Requirement: Auth afterSignUp hook provisions server user synchronously

The auth service SHALL register a `user.create.after` lifecycle hook with better-auth. The hook SHALL NOT provision users to the server regardless of `emailVerified` status. User provisioning is deferred until main account setup completes, triggered by main-owned routes after the user verifies email and submits Rezics account fields.

#### Scenario: Social sign-up with verified email does NOT provision immediately

- **WHEN** a user completes registration via a social/OAuth provider with a verified email
- **THEN** the `user.create.after` hook SHALL NOT call the provisioning endpoint
- **AND** the user SHALL remain unprovisioned on the main server until they complete main account setup

#### Scenario: Email/password sign-up skips provisioning

- **WHEN** a user completes email/password registration with an unverified email
- **THEN** the `user.create.after` hook SHALL NOT call the provisioning endpoint

### Requirement: Auth does not provision main users
The auth service SHALL NOT create or provision main `User` records from auth hooks, email verification handlers, `UserProfile`, provider callbacks, or auth session JWT exchange.

#### Scenario: Email verification succeeds
- **WHEN** an auth user verifies email
- **THEN** auth SHALL update auth-owned verification/session state
- **AND** auth SHALL NOT call the main user provisioning endpoint

#### Scenario: Social sign-up succeeds
- **WHEN** a user completes registration through an external provider
- **THEN** auth SHALL create or link auth-owned provider account records
- **AND** auth SHALL NOT create a main `User`
