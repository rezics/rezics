## Why

Rezics account identity is currently split between auth-owned `UserProfile`, auth-owned organization tables, and main-server `User` records. Now that main owns the public `/auth/*` boundary, this split creates duplicated authority, hard-to-reason provisioning, and a poor registration edge case: a user can have an auth session before a main user exists.

This change moves Rezics account creation and slug ownership fully into the main server while slimming auth down to credentials, sessions, verification, provider account linking, and OAuth/OIDC protocol storage. The registration flow will verify email before creating a main `User`, then collect the Rezics slug at the moment the main user is created.

## What Changes

- **BREAKING** Remove `auth.UserProfile` as the source of registration identity, slug readiness, and main-user provisioning.
- **BREAKING** Remove auth-owned organization as a product concept; developer/team ownership for Rezics OAuth apps will be modeled in main when needed.
- **BREAKING** Main `User` creation becomes the first moment a Rezics slug is claimed. Slug uniqueness is enforced by main `User.slug`, not by an auth-side profile table or a separate reservation table.
- Revise email/password registration to create an auth account and immediately lock the frontend into email verification until the user verifies email, cancels registration, or the temporary auth account is deleted.
- After email verification, route the user to a main-owned account setup step where they choose display name and slug; main creates the `User` and bootstraps shelves, default realm membership, search sync, and the main session.
- Revise third-party registration so provider-verified email proceeds directly to main account setup. Email editing during third-party registration is not supported; email changes happen later in account settings.
- Add explicit cancel-registration behavior. Cancel clears the browser auth session and marks or deletes the temporary auth account so later login/register attempts re-enter the correct verification/setup state.
- Ensure repeated login/register attempts for an unverified temporary auth account return to the email verification screen until verification completes or auth cleanup deletes the temporary account.
- Fix and harden auth email/OTP delivery and verification UX so resend, delivery errors, Turnstile failure, and already-pending accounts are visible and recoverable.
- Update main session refresh so it verifies an already-created main `User`; it does not invent fallback slugs or create main users from auth-only state.

## Capabilities

### New Capabilities

- `main-owned-account-registration`: Main-owned account creation, slug claiming, temporary auth account lifecycle, registration cancellation, and verified-email-to-main-user promotion.

### Modified Capabilities

- `app-auth-onboarding`: Registration and OAuth onboarding flow changes from mixed identity/email completion to verify-first, main-owned account setup.
- `registration-completion-page`: `/complete-registration` becomes a locked registration flow for auth-only users, with cancel support and no free browsing before main user creation.
- `main-auth-public-boundary`: Main gains explicit registration orchestration endpoints and stops treating auth-owned profile/organization routes as product account surfaces.
- `opaque-auth-session-refresh`: Main session refresh no longer provisions users using auth-only fallback data; it only issues `rezics-session-token` for existing main users.
- `auth-user-provisioning-hook`: Auth no longer provisions main users from `UserProfile` or verification hooks.
- `auth-organization`: Auth organization is removed as a Rezics product/account management surface.
- `auth-openapi-contracts`: Auth contracts are updated for temporary account state, cancel registration, verification resend/error responses, and removal of auth profile/organization surfaces.
- `email-otp-verification`: Verification email and OTP behavior is hardened for registration locking, resend, delivery failure, and re-entry.
- `rezics-oauth-oidc-provider`: OAuth client ownership/application flow is clarified so product ownership lives in main, while auth keeps only protocol records.

## Impact

- Affected packages: `package/auth`, `package/server`, `package/contract`, `package/api`, `package/app`, `package/admin`, and tests around auth/session/user provisioning.
- Database impact:
  - Auth Prisma schema removes or stops using `UserProfile`, `Organization`, `Member`, and `Invitation`.
  - Main server owns `User.slug`, `User.email`/verification readiness snapshots where needed, and the account setup endpoint that creates the final user.
  - Existing development data may be reset or migrated with a breaking cutover; no backward-compatible dual-write shim is required.
- API impact:
  - Auth remains responsible for sign-in, sign-up, sign-out, provider callbacks, verification, account linking, sessions, OAuth/OIDC token/userinfo/revoke/client protocol behavior, and JWKS.
  - Main owns registration completion, cancellation, main-user creation, main session issuance, and future developer organization/application management.
- Frontend impact:
  - Email/password registration locks the user into verification until complete or cancelled.
  - Provider registration with verified email skips email editing and proceeds to main account setup.
  - Auth-only temporary users cannot browse as guest-auth hybrids because no main user exists yet.
- Compatibility:
  - This is a breaking development-stage cutover. Internal routes, contracts, stores, and onboarding components should be updated in one pass.
  - Existing auth-only incomplete accounts may be deleted during migration or forced through the new verification/setup flow.
