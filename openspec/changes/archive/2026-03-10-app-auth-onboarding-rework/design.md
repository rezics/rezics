## Context

`package/app` currently treats authentication as a thin wrapper around JWT persistence plus a lazy `/users/me` fetch. This matches the recent separation between auth-owned and server-owned concerns, but it does not model better-auth session data such as `email`, `emailVerified`, provider identity, whether the user still needs to finish onboarding, or the distinction between an auth-registered account and a member-ready business identity.

The target change spans `package/app`, `package/api`, `package/auth`, and `package/ui`. It introduces new user-facing flows (email registration, OAuth login, email verification, post-OAuth onboarding), new provider coverage (Telegram), new app-level routing, and new self-service auth actions. The design must preserve the current JWT refresh architecture while adding a higher-level auth-session lifecycle that can drive redirects, banners, and guest-vs-member capability boundaries consistently.

Auth notifications are implemented in `package/auth` through a dedicated notification module. The initial delivery channel is SMTP/nodemailer email delivery, and the design must preserve a clean extension seam for future Telegram notifications after Telegram identity linking is available. The change must not rely on the `resend` library.

Constraints:

- Existing JWT refresh behavior in `package/api/src/react-query/jwt.ts` and `package/app-shell/src/provider/AuthProvider.tsx` must remain the source of bearer-token persistence.
- `UserDTO` from `GET /users/me` is business-profile data and does not currently expose `emailVerified`.
- The app already uses TanStack Router, React Query, and Zustand stores.
- better-auth is already configured in `package/auth`, but Telegram is not yet configured and current frontend auth client wrappers do not expose OAuth or self-service profile-completion actions.

When importing files **within the same package**, file extensions **should not be included**.
When importing files **from a different package**, file extensions **should be included**.

Example:
```
// in @rezics/app
import {RemarkPreview} from '../component/RemarkPreview';
import {ArrowForwardIcon} from '@rezics/ui/composite/navigation/ArrowForwardIcon.tsx';
```

API schema in @rezics/contract


## Goals / Non-Goals

**Goals:**

- Model app auth as explicit lifecycle states instead of a single authenticated boolean.
- Keep JWT persistence, auth-session state, and business-profile state separate but coordinated.
- Support email/password sign-in, email/password registration, OAuth sign-in, post-registration verification, and post-OAuth onboarding in the main app.
- Allow OAuth users to set required email and optional password, with correct locked/unlocked email behavior when provider email is already trusted.
- Ensure registered but unverified users can continue with guest-level browsing while being guided back to verification from app surfaces.
- Keep the implementation aligned with existing package layering: auth client wrappers in `package/api`, orchestration in `package/app`, shared auth widgets in `package/ui`, provider/backend support in `package/auth`.

**Non-Goals:**

- Redesign admin auth flows in `package/admin`.
- Merge auth-session metadata into `UserDTO` or into business-domain APIs unless required as a temporary compatibility bridge.
- Rebuild the entire user profile editing experience beyond the new auth-specific onboarding and verification pages.
- Change the existing token refresh transport contract.

## Decisions

### Decision: Introduce a dedicated auth-session store separate from `authStore` and `userProfileStore`

The app will keep `authStore` focused on persisted JWT state, keep `userProfileStore` focused on business profile data, and add a new store or query-backed cache for auth-session identity data such as:

- `email`
- `emailVerified`
- `hasPassword`
- `providers`
- `needsOnboarding`
- `needsEmailVerification`
- `onboardingSource`
- `hasBusinessToken`
- `capabilityLevel`

Rationale:

- `authStore` already has a clear responsibility: token persistence and JWT-derived identity fields.
- `UserDTO` does not encode auth lifecycle state and should not become the auth source of truth.
- A dedicated auth-session layer lets layouts, banners, and route guards react to onboarding state and guest-vs-member capability boundaries without forcing every page to infer from partial data.

Alternatives considered:

- Extend `userProfileStore` with auth metadata. Rejected because it blurs business profile and auth identity concerns.
- Extend JWT payload with all onboarding flags. Rejected because these flags are mutable account state and would become stale until token refresh.
- Add `emailVerified` to `/users/me` only. Rejected because onboarding needs more than one field and would still keep auth state coupled to a business API.

### Decision: Model the main app auth flow as an explicit state machine with separate auth-session and member-token readiness

The app will route users according to these lifecycle states:

- anonymous
- auth-account-unverified
- auth-account-needs-onboarding
- member-ready

Transitions:

- Email/password registration creates an auth session, does not mint a business JWT yet, hydrates auth session state, then redirects to verification.
- Email/password sign-in for an unverified account restores auth-session state but does not issue a business JWT and keeps the user at guest capability level.
- Email/password sign-in for a verified and ready account proceeds to member-ready and obtains the business JWT used for downstream services.
- OAuth callback completion hydrates auth session and redirects to onboarding until required setup is complete.
- Verification success returns the user to the original target or a safe default.
- Email edits during onboarding invalidate trusted-email assumptions and force re-verification before member token issuance.

Rationale:

- The product requirement is flow-driven, not page-driven.
- Redirect rules become deterministic and testable.
- The same state can drive banners, route guards, modal/page behavior, and the boundary between guest APIs and member APIs.

Alternatives considered:

- Page-local redirects only. Rejected because the same logic would be duplicated in login, register, callback, and layout code.
- Hard blocking all pages until verification completes. Rejected because the requirement explicitly allows guest-level browsing plus banner guidance before verification completes.

### Decision: Add dedicated auth routes instead of overloading existing login/register pages

New app routes will be introduced for:

- verification page
- OAuth onboarding page
- provider callback landing/redirect handling if frontend mediation is needed

Login and register remain entry routes, but onboarding and verification become first-class pages.

Rationale:

- The verification flow includes anti-abuse UX and stateful retry handling.
- OAuth onboarding has different validation and copy than registration.
- Dedicated routes are easier to deep-link, protect, and test.

Alternatives considered:

- Modal-only onboarding/verification. Rejected because these are multi-step post-auth flows that may need redirects and reload-safe restoration.
- Reusing profile settings page. Rejected because onboarding has different constraints and must run before the user is considered fully ready.

### Decision: Put the verification reminder banner in the main layout, not in page-level auth surfaces

The verification banner will be rendered from the main app shell/layout layer after auth-session bootstrap succeeds.

Rationale:

- The requirement applies to broad app navigation, not just to dedicated auth pages.
- Layout placement avoids repeated page wiring.
- Banner visibility can depend on a single auth-session selector that distinguishes guest-capable registered users from anonymous visitors and member-ready users.

Alternatives considered:

- Header-only reminder. Rejected because it is easier to miss and harder to keep consistent across responsive layouts.
- Notification-only reminder. Rejected because the requirement calls for a persistent banner.

### Decision: Expand `authApi` to expose self-service auth actions and OAuth helpers

`package/api` will wrap the frontend-facing auth actions needed by the app, such as:

- starting OAuth sign-in for a provider
- reading current auth session
- sending or resending verification email
- verifying email with anti-abuse token if backend contract requires it
- setting email
- setting password
- obtaining a member/business JWT only after readiness conditions are satisfied

Rationale:

- `package/app` should orchestrate flows, not construct ad hoc auth URLs or raw fetch payloads.
- Typed wrappers preserve the same architecture used elsewhere in the repo.

Implementation note:

- Auth notifications are delivered through an auth-owned notification module in `package/auth`.
- The initial delivery channel is email via SMTP/nodemailer.
- Telegram is a future notification extension and is not part of the current delivery implementation.

Alternatives considered:

- Direct fetch calls from pages. Rejected because that would duplicate error handling and break package layering.
- Reuse `userApi.updateMe` for email/password setup. Rejected because those actions belong to auth, not the business user service.

### Decision: Trust provider email only when auth backend marks it verified

If an OAuth provider returns an email that the auth backend accepts as verified, the backend remains the authority and the frontend shows that email as prefilled and locked by default. Editing unlocks the field and changes the flow into a re-verification-required path.

Rationale:

- The backend owns identity trust decisions.
- The frontend requirement is UX-oriented: explain the state and allow override safely.
- Member JWT issuance remains gated by backend-owned readiness checks rather than by frontend assumptions.

Alternatives considered:

- Let the frontend decide based on provider name alone. Rejected because trust semantics belong to auth backend behavior.
- Always require re-verification even for trusted provider email. Rejected because it adds friction and contradicts the intended streamlined OAuth flow.

### Decision: Treat Telegram as a provider-level backend addition with a frontend capability flag

Telegram support will be added in `package/auth` provider configuration and then surfaced in `package/app` through the same provider-button system used for other social sign-ins.

Rationale:

- Provider availability is backend-owned.
- Frontend code should render providers from a supported-provider contract or configuration rather than hardcoding assumptions that backend support already exists.

Alternatives considered:

- Add Telegram button in the app before auth backend support lands. Rejected because it creates dead UI and inconsistent environments.

### Decision: Unverified accounts keep guest capability instead of being fully blocked

The app will treat registered-but-unverified users as a distinct audience:

- they may have an auth session
- they may access guest-visible pages and guest APIs
- they may use auth self-service flows such as verification and onboarding
- they do not receive the business JWT required for member APIs until verification and readiness checks pass

Rationale:

- This matches the desired product behavior: browsing is still possible, but elevated capabilities are not.
- It keeps permission enforcement on the business JWT boundary rather than on UI-only conditions.
- It allows a persistent reminder banner without pretending that the user is already a full member.

Alternatives considered:

- Treat unverified users as fully anonymous. Rejected because they still need account-bound verification and onboarding flows.
- Treat unverified users as fully logged-in members with a warning banner. Rejected because it weakens permission boundaries and conflicts with the business JWT issuance rule.

## Risks / Trade-offs

- [Risk] Auth-session data and `userProfileStore` drift out of sync after login or email changes. → Mitigation: define a single post-auth bootstrap sequence and explicit invalidation points after set-email, verify-email, and logout.
- [Risk] Redirect loops between onboarding, verification, and normal app routes. → Mitigation: centralize redirect decisions in shared auth routing helpers and test all state transitions.
- [Risk] Telegram provider support differs from other providers in callback payload shape or email availability. → Mitigation: design onboarding to tolerate providers with no email and treat provider-trust decisions as backend-owned.
- [Risk] Existing pages assume `isAuthenticated` means "ready to use". → Mitigation: add readiness selectors (`isReady`, `needsVerification`, `needsOnboarding`, `hasBusinessToken`, `capabilityLevel`) and migrate route checks incrementally.
- [Risk] Turnstile introduces verification UX failure modes in development or misconfigured environments. → Mitigation: isolate the widget behind a reusable component contract and document fallback/error behavior clearly.
- [Risk] Registration currently expects `slug`, so removing it may impact downstream lazy-profile assumptions. → Mitigation: explicitly update onboarding/profile creation expectations and test first-session profile hydration for both email and OAuth users.

## Migration Plan

1. Add auth client wrappers and backend/provider support needed for onboarding, verification, and post-readiness member JWT issuance.
2. Introduce auth-session bootstrap state in the frontend without removing the existing JWT store.
3. Add new routes and shared auth components for verification, OAuth provider buttons, and onboarding forms.
4. Update login/register entry points and modal flows to use the new orchestration and capability-level decisions.
5. Add the global verification banner and route readiness checks.
6. Remove old registration assumptions such as required `slug` in the main app auth flow.

Rollback strategy:

- The change can be rolled back by restoring the old login/register pages and removing the new auth-session routing layer, provided backend provider additions remain backward compatible.
- Backend provider additions such as Telegram should be deployed behind environment-driven configuration so disabled providers disappear cleanly.

## Open Questions

- Which exact better-auth self-service endpoints are already exposed and typed versus needing new OpenAPI contract wrappers?
- A: Please check @rezics/auth/src/openapi
- Should guest-capable registered users see authenticated account chrome, guest chrome, or a hybrid header state before member JWT issuance?
- A: The header should be rendered as if the user is logged in. Most headers require data that the authentication server will provide. Naturally, this may cause some data to be unavailable and therefore prevent the header from being fully rendered. This is normal, and components should be designed to tolerate such partial data. At the same time, a verify email banner should be displayed.
- Should provider availability be discovered dynamically from auth backend configuration or kept as frontend environment/config for now?
- A: no, The specifications for services enabled on the backend should be documented in @rezics/contract.
