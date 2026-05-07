## 1. Schema and Contract Cutover

- [ ] 1.1 Audit all usages of `UserProfile`, auth organization routes, auth organization contracts, and auth-to-main provisioning with `rg` across `package/auth`, `package/server`, `package/contract`, `package/api`, `package/app`, and `package/admin`.
- [ ] 1.2 Update `package/auth/prisma/schema.prisma` to remove or stop using `UserProfile`, `Organization`, `Member`, and `Invitation` in the breaking cutover.
- [ ] 1.3 Add main-server schema fields needed to bind auth identity to `User` (for example `authUserId`, email snapshot, and verified-at/source fields if selected in implementation).
- [ ] 1.4 Generate Prisma clients for affected packages and adjust generated imports/exports as needed.
- [ ] 1.5 Update `package/contract/src/auth/*` to remove auth profile/organization surfaces and add pending-registration, cancel-registration, verification error, and setup-state schemas.
- [ ] 1.6 Add or update main-owned account setup and slug availability contracts in `package/contract`.
- [ ] 1.7 Run a repo-wide search for removed contract exports and update all callsites.

## 2. Auth Service Slimming and Verification Reliability

- [ ] 2.1 Remove the better-auth organization plugin from `package/auth/src/auth/instance.ts` and delete the public organization OpenAPI router from auth.
- [ ] 2.2 Remove auth identity/profile routes that create `UserProfile` or claim Rezics slugs in `package/auth/src/identity`.
- [ ] 2.3 Remove auth-to-main provisioning calls from verification handlers, identity handlers, provider callbacks, and helper modules.
- [ ] 2.4 Add normalized pending-registration state to auth session/self-service responses used by main and frontend.
- [ ] 2.5 Implement auth internal cancellation/delete support for temporary unverified registration accounts and session invalidation.
- [ ] 2.6 Add cleanup logic or a scheduled/admin-invoked command for stale temporary unverified auth accounts.
- [ ] 2.7 Investigate the current verification email bug in `package/auth/src/notification/*`, SMTP configuration, templates, and OTP routes.
- [ ] 2.8 Fix verification email/OTP send behavior so send, resend, cooldown, Turnstile failure, delivery failure, invalid OTP, expired OTP, and already-verified states return typed responses.
- [ ] 2.9 Add focused tests in `package/auth` for pending account re-entry, cancellation, stale cleanup, OTP resend, and mailer failure paths.

## 3. Main Registration Orchestration

- [ ] 3.1 Add a main-owned account setup API under the public auth/account boundary that validates the opaque auth session through auth.
- [ ] 3.2 In the setup API, require trusted verified email and reject auth-only unverified sessions before touching main `User`.
- [ ] 3.3 In the setup API, validate slug format and create `User` with main database uniqueness as the final slug authority.
- [ ] 3.4 Ensure successful setup bootstraps system shelves, default realm membership, and Meilisearch user sync using existing main services.
- [ ] 3.5 Ensure successful setup signs and sets the `rezics-session-token` httpOnly cookie.
- [ ] 3.6 Add a main-owned cancel-registration API that clears main cookies and calls auth internal cancellation/delete.
- [ ] 3.7 Update `/auth/session/refresh` so it only issues a main session for an existing main `User` and never creates fallback users or fallback slugs.
- [ ] 3.8 Update main auth middleware to resolve browser `rezics-session-token` cookies consistently for browser API requests, while keeping Authorization support for non-browser callers.
- [ ] 3.9 Remove registration usage of `/internal/users/provision` or restrict that endpoint to non-registration internal tooling.
- [ ] 3.10 Add targeted server tests for setup success, unverified rejection, slug conflict, duplicate setup, cancel registration, refresh without main user, and cookie-backed member API access.

## 4. Frontend API and State

- [ ] 4.1 Update `package/api/src/auth/auth.api.ts`, keys, queries, and mutations for pending-registration state, cancel registration, verification resend errors, and main account setup.
- [ ] 4.2 Remove frontend API calls to auth identity/profile and auth organization endpoints.
- [ ] 4.3 Update `package/api/src/states/authSessionStore.ts` to distinguish anonymous, pending verification, verified-needs-main-setup, and member-ready states.
- [ ] 4.4 Update token refresh helpers so failed main refresh with "main user missing" routes to setup instead of clearing useful auth state incorrectly.
- [ ] 4.5 Add API/state tests for pending re-entry, cancel cleanup, refresh rejection, and member-ready transition.

## 5. Frontend Registration UX

- [ ] 5.1 Rework `package/app/src/user/pages/RegisterPage.tsx` so email/password sign-up leads to locked verification and does not try to create or hydrate a main profile.
- [ ] 5.2 Rework `package/app/src/user/pages/LoginPage.tsx` so login for a pending auth account routes to the locked verification/setup flow.
- [ ] 5.3 Rework `package/app/src/user/pages/CompleteRegistrationPage.tsx` into a locked flow: email verification first, then main account setup with display name and slug.
- [ ] 5.4 Move slug availability checks to main-owned slug/account setup APIs.
- [ ] 5.5 Add a cancel-registration affordance with confirmation, loading, success, error, and anonymous-state cleanup.
- [ ] 5.6 Update OAuth provider callback handling so trusted provider email goes directly to main account setup and untrusted/missing email goes to verification.
- [ ] 5.7 Remove inline email editing from third-party registration; keep email changes in post-registration account settings.
- [ ] 5.8 Ensure pending auth-only users cannot navigate into normal app chrome that assumes a main user exists.
- [ ] 5.9 Update localization strings and accessibility labels for verification lock, resend failure, cancel registration, setup slug conflict, and provider email messaging.

## 6. Admin, OAuth App Ownership, and Removed Surfaces

- [ ] 6.1 Remove or update `package/admin` pages and navigation that depend on auth organization routes.
- [ ] 6.2 Keep auth-owned OAuth/OIDC protocol routes (`authorize`, `token`, `userinfo`, `revoke`, protocol client storage) working through main public `/auth/*`.
- [ ] 6.3 Document that future OAuth app ownership/developer teams are main-owned product entities, not auth organizations.
- [ ] 6.4 If existing OAuth client registration UI or admin tooling exists, update it to use main-owned authorization before syncing minimal protocol client data to auth.

## 7. Migration and Cleanup

- [ ] 7.1 Add a development-stage migration plan for deleting or resetting existing `auth.UserProfile` and auth organization data.
- [ ] 7.2 Remove stale profile sync code from main to auth where it only existed to keep auth `UserProfile` or auth user slug/avatar state updated.
- [ ] 7.3 Remove stale tests and fixtures that assume `auth.UserProfile` is the registration identity source.
- [ ] 7.4 Update OpenAPI docs and README/developer notes for the new registration and auth boundary responsibilities.
- [ ] 7.5 Run `rg` checks to confirm no product code depends on `/auth/organization`, `UserProfile`, or auth identity slug endpoints.

## 8. Validation

- [ ] 8.1 Run targeted `bun test` suites for `package/auth` auth routes, OTP, mailer, and session state.
- [ ] 8.2 Run targeted `bun test` suites for `package/server` auth boundary, session refresh, user creation, and permission middleware.
- [ ] 8.3 Run targeted `bun test` suites for `package/api` auth API, auth session store, and token refresh helpers.
- [ ] 8.4 Run targeted `bun test` suites for `package/app` registration routing, complete-registration page state, OAuth redirect helpers, and cancel registration.
- [ ] 8.5 Run formatting/typecheck/build commands required by affected packages.
- [ ] 8.6 Manually verify browser flows: email registration, resend OTP, invalid OTP, cancel registration, login re-entry before verification, verified setup with slug conflict, OAuth trusted email setup, sign-out, and session refresh after reload.
