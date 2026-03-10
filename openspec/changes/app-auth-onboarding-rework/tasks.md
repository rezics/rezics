## 1. Auth backend and contract preparation

- [ ] 1.1 Audit better-auth self-service endpoints needed for app onboarding and verification, then add or document typed contract coverage in `package/contract/src/auth/*` and `package/auth/src/openapi/*`.
- [ ] 1.2 Add Telegram provider support in `package/auth/src/auth/instance.ts` behind environment-driven configuration and keep unsupported providers disabled cleanly.
- [ ] 1.3 Expose or normalize auth-session fields needed by the frontend onboarding flow (for example trusted email state, verification state, provider context, and password presence) through the auth-facing session/self-service surface.
- [ ] 1.4 Add or update backend tests covering Telegram provider configuration and any new self-service auth contracts used by the frontend.

## 2. Frontend auth API surface

- [ ] 2.1 Extend `package/api/src/auth/auth.api.ts` with typed helpers for auth-session retrieval, OAuth initiation, email verification actions, set-email, set-password, and readiness-gated member JWT acquisition.
- [ ] 2.2 Update `package/api/src/auth/auth.keys.ts`, `auth.queries.ts`, `auth.mutations.ts`, and `auth.ts` exports so the new auth actions are available through the existing shared API layer.
- [ ] 2.3 Grep `package/app`, `package/app-shell`, and other consumers for direct auth fetches or inline provider URLs and migrate them to the shared `authApi` abstractions.

## 3. Frontend auth state and bootstrap

- [ ] 3.1 Introduce an auth-session state module in `package/app` or `package/app-shell` that stores auth readiness fields separately from JWT persistence and `userProfileStore`.
- [ ] 3.2 Update app bootstrap logic around `package/app-shell/src/provider/AuthProvider.tsx`, `package/app/src/app/App.tsx`, and related hooks so auth-session state is hydrated after login, registration, refresh, and reload.
- [ ] 3.3 Update `package/app/src/user/page/useAuth.ts` and any route-level auth checks to distinguish auth-session presence, guest capability, `needsOnboarding`, `needsVerification`, `hasBusinessToken`, and ready-for-app usage.
- [ ] 3.4 Verify logout clears token state, auth-session state, and business-profile state without regressions to token refresh behavior.

## 4. Auth routes and shared UI components

- [ ] 4.1 Add dedicated app routes and page modules for email verification and OAuth onboarding under `package/app/src/routes` and `package/app/src/user/page`.
- [ ] 4.2 Rework `package/app/src/user/page/RegisterPage.tsx` to use email-and-password-only registration and redirect into the verification flow instead of the old slug-first flow.
- [ ] 4.3 Rework `package/app/src/user/page/LoginPage.tsx`, `package/app/src/user/component/AuthModal.tsx`, and related auth entry surfaces to support both email/password and OAuth providers.
- [ ] 4.4 Create reusable auth UI pieces for provider buttons, set-email form behavior, set-password form behavior, and trusted-email edit affordances using shared components in `package/ui` where appropriate.
- [ ] 4.5 Integrate `package/ui/src/composite/auth/Turnstile.tsx` into the verification page with explicit loading, failure, and retry states.

## 5. Global layout and flow orchestration

- [ ] 5.1 Add a global verification reminder banner to `package/app/src/core/layout/MainLayout.tsx` or an equivalent shared layout surface, driven by auth-session state rather than `UserDTO`.
- [ ] 5.2 Implement shared redirect/orchestration helpers so email sign-in, email registration, OAuth callback completion, verification success, and onboarding completion resolve to deterministic destinations.
- [ ] 5.3 Remove remaining primary-flow assumptions that registration requires `slug`, and update any copy, validation, or helper code that still treats `/users/me` as the only auth lifecycle source.
- [ ] 5.4 Review localization and accessibility for new login, registration, onboarding, verification, and banner flows across active locales.

## 6. Validation and regression coverage

- [ ] 6.1 Add targeted frontend tests for registration redirect, OAuth onboarding redirect, trusted-email edit behavior, verification banner visibility, and logout state clearing.
- [ ] 6.2 Add targeted integration tests for auth-session bootstrap across page reload, token refresh, and authenticated-but-unverified scenarios.
- [ ] 6.3 Run affected test suites and verification commands for `package/auth`, `package/api`, `package/ui`, and `package/app`, then fix any regressions introduced by the new auth flow.
- [ ] 6.4 Perform a repo-wide compile or typecheck verification after export changes and shared auth API additions to confirm all consumers build cleanly.
