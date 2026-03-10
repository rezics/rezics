## Why

The current `package/app` authentication flow only models "has JWT" and treats registration as a direct variant of sign-in. That is no longer sufficient now that the auth backend supports better-auth sessions, OAuth providers, token refresh, and email verification states that must be reflected in the main product.

This change is needed now because the app must support email/password registration, third-party OAuth sign-in, post-OAuth onboarding, and persistent email-verification guidance without duplicating auth state across pages or relying on incomplete business-profile data. It also needs a precise boundary between guest-capable registered accounts and member-ready accounts that are allowed to receive the business JWT used for non-guest APIs.

## What Changes

- Replace the current `package/app` login and registration flows with a staged auth experience that distinguishes sign-in, registration, post-registration verification, and post-OAuth onboarding.
- Simplify email/password registration to require only email and password, then redirect newly registered users to a dedicated email verification page.
- Add OAuth sign-in entry points to the app login/register surfaces, including support for the providers already configured in auth and newly added Telegram support.
- Introduce a dedicated onboarding page for OAuth sign-ins where email is required and password is optional.
- Add self-service UI components and client abstractions for setting email, setting password, and verifying email.
- Route auth-owned notification delivery through an extensible backend notification layer in `package/auth`, with SMTP/nodemailer email delivery now and room for future Telegram notifications after account linking.
- Embed `Turnstile` in the email verification flow to protect resend or verification actions from abuse.
- Add a global in-app verification banner so registered but unverified users can continue browsing with guest-level capabilities while being reminded to return to the verification flow.
- Extend frontend auth state so the app can reason about auth-session identity fields such as `email`, `emailVerified`, provider-backed onboarding state, guest-vs-member capability boundaries, and redirect requirements instead of only checking JWT presence.
- **BREAKING** Remove `slug` from the primary app registration flow and stop treating `/users/me` business-profile data as the sole source of frontend auth lifecycle state.
- **BREAKING** Treat business JWT issuance as a post-verification readiness step instead of assuming every authenticated auth-session user immediately receives member-level API access.

## Capabilities

### New Capabilities
- `app-auth-onboarding`: Main app auth entry, onboarding, verification, and guest-to-member progression behavior for email/password and OAuth users.

### Modified Capabilities
- `frontend-auth-state-separation`: Extend frontend auth state management so auth-session metadata, guest-vs-member capability state, and onboarding requirements are modeled separately from JWT persistence and business profile data.

## Impact

- Affected packages: `package/app`, `package/api`, `package/auth`, `package/ui`.
- Affected frontend surfaces: login page, register page, auth modal, app bootstrap, main layout, header/account surfaces, and new auth routes for verification and onboarding.
- Affected auth client API surface: additional self-service auth actions, OAuth redirect helpers, and readiness-aware token acquisition will be needed in `package/api`.
- Affected auth backend surface: frontend-consumable self-service endpoints/contracts and auth-owned notification delivery must be available through `package/auth`; notification delivery uses SMTP/nodemailer rather than the `resend` library.
- Backward compatibility: existing email/password sign-in should remain functional for verified users, but registration behavior, post-auth redirects, and member-token issuance assumptions will change. Existing direct assumptions that "authenticated means fully ready" will need migration in `package/app`.
- Migration needs: app routes, stores, and auth helpers must be updated together so no page relies on stale `slug`-first registration, on `UserDTO` alone for `emailVerified` checks, or on auth-session existence alone as proof of member-level access.
