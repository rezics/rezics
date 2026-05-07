## 1. Boundary Documentation and Contract Shape

- [x] 1.1 Update auth/main boundary docs to define `auth.User.email` as login email and `server.User.email` as main-owned Rezics email.
- [x] 1.2 Document that `auth.User.name` is a technical auth label populated from main slug and must not be used as Rezics display name.
- [x] 1.3 Add shared contract types for account stages: anonymous, registration verification required, profile setup required, and member ready.
- [x] 1.4 Add shared contract schemas for verified registration facts returned from auth to main.
- [x] 1.5 Add shared contract schemas for profile setup token state, setup renewal, and typed profile setup errors.

## 2. Shared Email Sender and Server Env

- [x] 2.1 Add nodemailer sender creation utilities to `package/email` and export them from `@rezics/email`.
- [x] 2.2 Ensure `@rezics/email` sender utilities accept explicit config and do not read `process.env` or service env modules.
- [x] 2.3 Add or update `package/email` tests for sender config, sender formatting, and delivery failure propagation.
- [x] 2.4 Update auth email delivery to use `@rezics/email` sender utilities while keeping auth-owned env validation.
- [x] 2.5 Update notify email delivery to use `@rezics/email` sender utilities where it overlaps with SMTP sender creation.
- [x] 2.6 Complete `package/server/src/env.ts` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIN_EMAIL_FROM_EMAIL`, and `MAIN_EMAIL_FROM_NAME`.
- [x] 2.7 Complete `package/server/.env.example` with documentation for `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIN_EMAIL_FROM_EMAIL`, and `MAIN_EMAIL_FROM_NAME`.

## 3. Main Database and Email Verification Contracts

- [x] 3.1 Update `package/server/prisma/schema.prisma` to remove `User.emailVerifiedAt` and `User.emailVerificationSource`.
- [x] 3.2 Add main email verification contract storage keyed by `contractName`, `ownerId`, and `email`.
- [x] 3.3 Add schema comments documenting that `User.email` is main-owned and not synchronized with auth login email.
- [x] 3.4 Add or update main user status fields needed to distinguish profile setup from member-ready users.
- [x] 3.5 Implement main email verification contract delivery using `@rezics/email` with server-owned env-derived config.
- [x] 3.6 Generate the server Prisma client and update generated imports as needed.
- [x] 3.7 Run repo-wide `rg` checks for removed main verification columns and update all callsites.

## 4. Auth Service Facts and Slug Projection

- [x] 4.1 Add or update auth internal response shape to expose minimal verified registration facts for main materialization.
- [x] 4.2 Ensure auth verification routes mutate only auth-owned verification state and do not create or update main product data.
- [x] 4.3 Add auth-side slug login alias or technical name update support for main-originated projection.
- [x] 4.4 Ensure auth `User.name` is populated from main slug only as a technical label where better-auth requires it.
- [x] 4.5 Add auth tests for verified registration facts and slug projection update behavior.

## 5. Main Token and Guard Split

- [x] 5.1 Add signing and verification helpers for `rezics-profile-setup-token` with explicit setup purpose/type claims.
- [x] 5.2 Set default profile setup token TTL to 15 minutes and enforce expiration server-side.
- [x] 5.3 Add setup token renewal from a valid auth session while the user remains profile-setup-required.
- [x] 5.4 Update `rezics-session-token` verification to require member-session purpose/type where needed.
- [x] 5.5 Add a server route macro for profile setup routes that accepts only `rezics-profile-setup-token`.
- [x] 5.6 Update existing `requireLogin` macro to accept only normal member `rezics-session-token` and reject profile setup tokens.
- [x] 5.7 Update sign-out to clear both `rezics-session-token` and `rezics-profile-setup-token`.
- [x] 5.8 Add focused middleware tests for member token, setup token, expired setup token, setup renewal, invalid token, and wrong-token-on-route cases.

## 6. Main Registration Materialization and Profile Setup

- [x] 6.1 Split current main account setup into a materialization endpoint and a profile setup completion endpoint.
- [x] 6.2 Implement main materialization to validate auth session through auth and create a minimal `User` from verified registration facts.
- [x] 6.3 During materialization, initialize `User.email` from verified auth email and create or mark the `user.email` verification contract.
- [x] 6.4 Ensure materialization issues only `rezics-profile-setup-token` and never `rezics-session-token`.
- [x] 6.5 Implement profile setup completion with slug validation, slug uniqueness, optional name/avatar, and default name from slug.
- [x] 6.6 Move member bootstrap work to profile setup activation: shelves, default realm membership, search sync, and member token issuance.
- [x] 6.7 Implement admin-only slug change in main and trigger auth slug alias projection after canonical update.
- [x] 6.8 Add server tests for materialization success, unverified rejection, duplicate materialization, setup token issuance, setup renewal, profile setup slug conflict, profile setup activation, and admin slug projection.

## 7. API Client and Frontend State

- [ ] 7.1 Update `package/api` auth/account APIs for materialization, profile setup, setup token renewal, profile setup token state, and main email verification contracts.
- [x] 7.2 Update frontend auth session store to model auth identity, profile setup session, member session, and account stages separately.
- [x] 7.3 Treat public account-stage cookies as routing hints only and confirm state through authoritative server probes.
- [x] 7.4 Update token refresh helpers so profile-setup-required responses route to profile setup instead of clearing useful auth state.
- [x] 7.5 Add API/state tests for registration verification, profile setup, setup token renewal, member-ready, stale hint cookie, and refresh rejection states.

## 8. Frontend Registration and Settings UX

- [ ] 8.1 Update registration pages so auth-only users remain locked in registration verification and do not call normal main product APIs.
- [x] 8.2 Update complete-registration flow to request main materialization after verification and then continue under profile setup token.
- [x] 8.3 Update profile setup UI to submit slug, optional name/avatar, and default display name from slug when blank.
- [ ] 8.4 Update OAuth callback handling for trusted provider facts, untrusted verification, materialization, and profile setup routing.
- [ ] 8.5 Update Account/Profile settings Rezics email UX to use main email verification contracts and write only verified email to `User.email`.
- [ ] 8.6 Move auth login email change UX to Security settings alongside password, sessions, and connected providers.
- [ ] 8.7 Update frontend route guards so normal app chrome requires member-ready state.
- [ ] 8.8 Add localized strings and accessible error/success states for login email, Rezics email, materialization, profile setup, slug conflict, email verification contract errors, setup token renewal, and stale account-stage hints.

## 9. Admin and Migration Cleanup

- [ ] 9.1 Update admin user views to display main email semantics and avoid auth verification fields.
- [x] 9.2 Add admin slug update flow or server/API support for rare canonical slug changes.
- [ ] 9.3 Remove stale tests, fixtures, API types, and UI copy that assume auth email verification columns exist on main `User`.
- [x] 9.4 Add a development-stage migration/reset note for removing old main verification columns and reinitializing main email verification contract data.
- [x] 9.5 Run `rg` checks for `emailVerifiedAt`, `emailVerificationSource`, old setup endpoint names, stale registration stage names, and duplicated SMTP sender creation.

## 10. Validation

- [x] 10.1 Run targeted `bun test` suites for `package/email` sender utilities and rendering.
- [x] 10.2 Run targeted `bun test` suites for `package/auth` registration facts, verification, auth email delivery, and slug projection.
- [ ] 10.3 Run targeted `bun test` suites for `package/server` auth boundary, profile setup token guard, materialization, profile setup activation, session refresh, and email verification contracts.
- [x] 10.4 Run targeted `bun test` suites for `package/api` auth/account API helpers and auth session state.
- [ ] 10.5 Run targeted `bun test` suites for `package/app` registration routing, complete-registration, profile setup, OAuth callback, route guards, Security login email settings, and Account/Profile Rezics email flow.
- [ ] 10.6 Run formatting/typecheck/build commands required by affected packages.
- [ ] 10.7 Manually verify browser flows: email registration, verification resend, login re-entry during verification, materialization, setup token renewal after expiry, profile setup slug conflict, member activation, OAuth trusted email, sign-out, session refresh after reload, login email change, and Rezics email change verification.
