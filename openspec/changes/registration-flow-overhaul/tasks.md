## 1. Auth Service -- Identity Step Endpoint

- [x] 1.1 Add slug format validation utility to `@rezics/auth` (port rules from `package/server/src/user/model/slugVerify.ts`: 6-32 chars, alphanumeric + hyphens, no leading/trailing/consecutive hyphens, reserved words list)
- [x] 1.2 Create `POST /api/auth/identity/confirm` endpoint in auth service -- accepts `{ username, slug }`, validates slug format + uniqueness, creates `UserProfile` row, updates `User.name`. Returns 409 on slug conflict, 400 on invalid format, 403 if UserProfile already exists
- [x] 1.3 Create `GET /api/auth/identity/check-slug` endpoint -- validates format + uniqueness, returns availability status without creating records
- [x] 1.4 After successful UserProfile creation in the confirm endpoint, check `user.emailVerified` -- if true, call `provisionUserOnServer({ unitId, slug, name })`; log errors without rolling back UserProfile

## 2. Auth Service -- Provisioning Hook Changes

- [x] 2.1 Remove provisioning logic from `user.create.after` hook in `package/auth/src/auth/instance.ts` -- the hook SHALL NOT provision users regardless of `emailVerified` status
- [x] 2.2 Update verify-email route interceptor in `package/auth/src/auth/routes.ts` to check UserProfile existence before calling `provisionUserOnServer()` -- skip provisioning if no UserProfile exists
- [x] 2.3 Ensure `provisionUserOnServer()` reads slug from `UserProfile` (not derived from `user.name`) in the verify-email path

## 3. Auth Service -- Slug Immutability

- [x] 3.1 Add guard to reject slug updates on any user-facing endpoint when `UserProfile` already exists for the user (only admin role can update slug)
- [x] 3.2 Verify that the JWT `definePayload` in `instance.ts` continues to include `slug` from UserProfile (already does via `user.slug`)

## 4. Contract Updates

- [x] 4.1 Update `authSessionStateSchema` in `package/contract/src/auth/self-service.ts` -- replace `needsOnboarding` + `needsVerification` with `identitySet: boolean` and `emailVerified: boolean` (or add `registrationComplete: boolean` derived field)
- [x] 4.2 Add contract types for the identity confirm endpoint (`{ username, slug }` body, response schema) and check-slug endpoint
- [x] 4.3 Update `authReadinessStatusSchema` -- replace `needs-onboarding` / `needs-verification` with `needs-registration` (or similar) and `ready`
- [x] 4.4 Grep repo-wide for usages of `needsOnboarding`, `needsVerification`, `needs-onboarding`, `needs-verification` and update all references

## 5. Server -- Exchange Auto-Provision Update

- [x] 5.1 Update `POST /session/exchange` in `package/server/src/session/session.api.ts` to require both `email_verified` (absent = verified) AND non-null `slug` claim in JWT before auto-provisioning. Return 403 "Registration incomplete" if slug is missing
- [x] 5.2 Verify idempotent upsert behavior is preserved for concurrent provisioning

## 6. API Client Layer

- [x] 6.1 Add query/mutation hooks in `@rezics/api` for identity confirm endpoint and check-slug endpoint
- [x] 6.2 Update existing auth session state hooks to use new contract types (`identitySet`, `emailVerified` instead of `needsOnboarding`, `needsVerification`)

## 7. Frontend -- Complete Registration Page

- [x] 7.1 Create `/complete-registration` route and `CompleteRegistrationPage` component in `package/app`
- [x] 7.2 Implement Step 1 UI: username + slug form with real-time slug availability check (debounced), format validation (client-side), and "Confirm" submit button
- [x] 7.3 Implement Step 2 UI: email display with Turnstile + OTP flow (reuse existing verify-email logic)
- [x] 7.4 Implement OAuth pre-fill: populate username and slug from auth session data (User.name -> derive slug), show email as "verified by [Provider]" with Edit button + confirmation dialog
- [x] 7.5 Implement completed-step display: read-only view with checkmark for each completed step
- [x] 7.6 Implement provisioning trigger: when the last step completes, call `exchangeForSessionToken()` and refresh auth session state
- [x] 7.7 Add redirects from `/verify-email` and `/onboarding` to `/complete-registration`

## 8. Frontend -- Auth State and Header Updates

- [x] 8.1 Update `useAuth` hook in `package/app/src/user/page/useAuth.ts` to derive `registrationComplete` from `identitySet && emailVerified` (replacing `needsOnboarding` + `needsVerification`)
- [x] 8.2 Update `MainLayoutHeader.tsx` to show registration prompt when `!registrationComplete` instead of checking `needsVerification`
- [x] 8.3 Rename/rework `PendingVerificationSection` to `PendingRegistrationSection` -- button text "Complete Registration" linking to `/complete-registration`
- [x] 8.4 Update `resolvePostAuthDestination` and `buildOAuthCallbackTargets` in `authRedirect.ts` to use `/complete-registration` instead of `/verify-email` and `/onboarding`
- [x] 8.5 Update `useAuthSessionStore` to use new contract fields

## 9. Frontend -- Auth-Gated Action Prompts

- [x] 9.1 Grep for "Verify your email" / "verify_banner_action" / "Sign in to" prompts across `package/app` and update to "Complete registration to [action]" for incomplete-registration users
- [x] 9.2 Update i18n translation keys: replace `auth.flow.verify_banner_action` with registration-completion equivalents

## 10. Cleanup

- [x] 10.1 Remove `OAuthOnboardingPage` component and its route definition
- [x] 10.2 Remove `VerifyEmailPage` component (logic moved to CompleteRegistrationPage Step 2)
- [x] 10.3 Remove `needsOnboarding` from auth session store and all consuming code
- [x] 10.4 Verify build passes across all packages (`bun run build` in server, auth; type-check in app)
- [ ] 10.5 Test: email/password registration -> complete-registration page -> Step 1 -> Step 2 -> provisioned
- [ ] 10.6 Test: OAuth registration -> complete-registration page (pre-filled) -> confirm identity -> already verified -> provisioned
- [ ] 10.7 Test: interrupted flow -- complete Step 1, browse app, return to complete Step 2
- [ ] 10.8 Test: slug conflict handling -- submit taken slug, see error, pick different one
