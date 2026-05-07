## Why

Rezics split auth into an independent service, but account data still mixes auth-owned identity facts with main-owned product profile state. This creates unclear ownership for email, slug, verification state, registration readiness, and main session issuance.

This change makes the boundary explicit before more auth flows are built on top of the current coupling.

## Problem

The current implementation treats some fields as both auth fields and main fields:

- `auth.User.email` is the login email, while `server.User.email` is starting to act like a product/social email.
- `auth.User.name` may be required by better-auth, but Rezics product display name belongs to main.
- `server.User.emailVerifiedAt` and `server.User.emailVerificationSource` look like auth verification facts even though auth is the verification authority.
- Pending registration, profile setup, and normal member login are not cleanly separated.
- A limited account-completion user should not be able to call normal member APIs, but adding ad hoc capability checks to every handler would make the API layer noisy.

## Goals

- Keep `server.User.email` as the main-owned Rezics primary/profile email while documenting that it is initialized from, but not synchronized with, the auth login email.
- Move auth verification facts out of `server.User`; write only verified main emails into `server.User.email`.
- Introduce a main-owned email verification contract table for product email fields such as `user.email` and future `org.email`.
- Treat `server.User.slug` as the canonical Rezics slug and auth-side slug/name as a one-way login alias projection.
- Separate registration verification, profile setup, and member-ready states.
- Use a separate profile-setup token/cookie instead of broad `capability` checks on every normal member request.
- Put shared nodemailer sender creation in existing `@rezics/email`, with each caller reading its own env and passing explicit config to the sender.
- Separate frontend settings for auth login email/password from main Rezics email.
- Document that `auth.User.name` is a technical auth label populated from main slug, not the Rezics display name.
- Preserve development-stage breaking cutover behavior with no compatibility shims.

## Non-goals

- Redesign all account settings UI beyond the states and email/slug ownership required here.
- Support dual-write or backward-compatible aliases for old auth/profile fields.
- Add public browsing or normal member API access before registration verification completes.
- Make auth own Rezics product profile data, developer organization data, or main permissions.
- Introduce general-purpose fine-grained capability authorization for all product APIs.

## Scope

This change covers account identity ownership, registration/profile state transitions, main email verification records, auth slug login aliases, and the token/cookie split between profile setup and member sessions.

It does not implement the resulting code changes yet; implementation will be handled by `/opsx:apply`.

## What Changes

- **BREAKING** Remove `emailVerifiedAt` and `emailVerificationSource` from main `User`; these are auth verification facts or main email verification contract records, not profile columns.
- **BREAKING** Define `server.User.email` as main-owned Rezics email, not auth login email. It may be initialized from a verified auth login email during registration materialization but SHALL NOT be automatically synchronized afterward.
- Add a main-owned email verification contract model keyed by a contract name, owner id, and email, for example `("user.email", userId, email)` and future `("org.email", orgId, email)`.
- Require email values written into main product records to be verified through the relevant main email contract flow.
- Add shared nodemailer sender utilities to `@rezics/email`. The package SHALL NOT read env directly; auth, main, and notify read their own env and pass sender config.
- Complete server email env documentation for the variables main will pass to `@rezics/email`.
- Treat `server.User.slug` as canonical and auth-side slug/login alias as a one-way projection maintained by main.
- Allow admin-only slug changes through main, with main notifying auth to update the login alias / technical auth name after the canonical change.
- Document `auth.User.name = main.User.slug` as a technical auth label only; product UI must use `server.User.name`.
- Split account states into:
  - anonymous,
  - registration verification required,
  - profile setup required,
  - member ready.
- For registration verification required state, keep the user auth-only: no main `User`, no main token, and no normal main product communication.
- For profile setup required state, create a minimal main `User` and issue a separate `rezics-profile-setup-token` cookie that is accepted only by profile setup routes.
- Set `rezics-profile-setup-token` default TTL to 15 minutes and allow renewal from a valid auth session while the user remains profile-setup-required.
- Keep `rezics-session-token` as the normal member token with no broad capability concept.
- Add a frontend-readable account-stage hint cookie for routing only; server probes and token validation remain authoritative.
- Split frontend settings so login email/password live in Security, while Rezics product email lives in Account/Profile settings.

## Capabilities

### New Capabilities

- `account-identity-boundary`: Defines ownership and synchronization rules for auth login email, main email, canonical slug, auth slug login alias, auth technical name, and main display name.
- `main-email-verification-contracts`: Defines main-owned verification records for product email fields such as `user.email` and future `org.email`.
- `profile-setup-session`: Defines the separate profile setup token/cookie, its route guard, and its relationship to normal member sessions.
- `shared-email-sender`: Defines shared nodemailer sender creation in `@rezics/email` with service-owned env/config inputs.

### Modified Capabilities

- `main-owned-account-registration`: Registration no longer creates a full member user in one step; it separates auth-only verification, minimal main user materialization, profile setup, and member activation.
- `main-auth-public-boundary`: Clarifies which registration actions are auth-only, which are proxied by main, and when main may request verified auth user facts for user materialization.
- `opaque-auth-session-refresh`: Clarifies that `rezics-session-token` is member-only and distinct from the profile setup token.
- `app-auth-onboarding`: Frontend onboarding routes must distinguish registration verification, profile setup, and member-ready states.
- `frontend-auth-state-separation`: Frontend state must treat public account-stage cookies as hints and server probes as authoritative.
- `server-permission-guards`: Normal `requireLogin` remains member-only; profile setup routes use a separate guard rather than per-route capability checks.
- `settings-account`: Account/Profile settings own Rezics product email, visibility, and main email verification.
- `settings-security`: Security settings own auth login email, password, sessions, and provider/security controls.

## Impact

- Affected packages:
  - `package/auth`
  - `package/server`
  - `package/email`
  - `package/contract`
  - `package/api`
  - `package/app`
  - `package/admin`
- Database impact:
  - Main `User` removes auth verification columns.
  - Main adds email verification contract storage.
  - Main may add explicit user status/profile setup state.
  - Auth may add or normalize a slug login alias projection if better-auth does not already provide a suitable login identifier table.
- API impact:
  - Main account materialization and profile setup endpoints become separate.
  - Normal member routes continue using `requireLogin` and `rezics-session-token`.
  - Profile setup routes use `rezics-profile-setup-token`.
  - Auth session APIs expose verified registration facts needed by main but do not expose product profile authority.
  - Auth/main/notify email delivery code uses `@rezics/email` sender utilities with per-service env-derived config.
- Frontend impact:
  - The app routes auth-only users to registration verification.
  - The app routes profile-setup users to profile completion only.
  - Normal product chrome requires member-ready state.
  - Settings UI separates auth login email from Rezics product email.
- Compatibility:
  - This is a development-stage breaking cutover.
  - No aliases, dual-write shims, or legacy route compatibility are planned.
  - Existing development data can be reset or migrated in one direction.
