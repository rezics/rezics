## Context

Rezics currently has two competing account boundaries:

- Auth owns better-auth users, sessions, provider accounts, verification records, `UserProfile`, and organization plugin tables.
- Main owns product `User` records, public profile data, slug uniqueness, shelves, default realm membership, Meilisearch user documents, and main session tokens.

The current onboarding flow lets a browser become auth-authenticated before a main `User` exists. The frontend can then ask the user to complete identity and email verification, while main refresh/provision code tries to recover by creating a user from auth session state. This creates several problems:

- `auth.UserProfile.slug` and `server.User.slug` duplicate the public Rezics identity namespace.
- Main refresh currently has a fallback that can create a main user with `slug = userId`, which bypasses the intended slug choice.
- Auth-to-main provisioning occurs from multiple places: identity confirmation, email verification hooks, and refresh fallback.
- Auth organization is a product concept in the wrong service. It was useful when auth was more independent, but under the main public boundary product teams/developer ownership should live in main.
- The frontend needs a locked pending-registration state: the user has an auth session, but no main user and no member capability.
- Verification email and OTP delivery errors must be surfaced and recoverable, because pending registration cannot proceed without them.

The target model is:

```
browser
  │
  ▼
main /auth/*
  │
  ├─ proxy auth-owned login/session/provider/verification protocol routes
  │
  └─ own registration orchestration, pause, and main user creation

auth
  ├─ credentials / provider account links
  ├─ auth sessions
  ├─ email verification / OTP
  ├─ OAuth/OIDC protocol records and tokens
  └─ no Rezics profile, slug, or organization ownership

main
  ├─ Rezics User and slug uniqueness
  ├─ verified account setup
  ├─ developer organization / OAuth app product ownership
  ├─ shelves/default realm/search bootstrap
  └─ rezics-session-token issuance
```

## Goals / Non-Goals

**Goals:**

- Make main server the only authority for Rezics account creation, profile identity, and slug uniqueness.
- Keep auth slim: sign-in, sign-up, sign-out, sessions, email verification, external provider account linking, OAuth/OIDC protocol behavior, and JWKS.
- Require email verification before creating a main `User` for email/password registration.
- Let provider registrations with trusted provider email proceed directly to main account setup.
- Remove email editing from third-party registration; email changes happen after the main account exists.
- Lock auth-only pending users into registration completion, while allowing explicit pause/sign-out.
- Ensure login/register re-entry for pending auth users always resumes the correct verification/setup step.
- Fix verification email/OTP flow so delivery, resend, Turnstile, and pending-account errors are visible and testable.
- Avoid compatibility shims; this is a development-stage breaking cutover.

**Non-Goals:**

- Redesign the full profile settings page beyond moving email changes out of registration.
- Implement the full developer organization UI unless needed to replace auth organization routes exposed today.
- Change OAuth/OIDC grant validation, token exchange, userinfo, or revoke protocol implementation away from better-auth/oauth-provider.
- Support browsing as an auth-only user before the main `User` exists.
- Preserve `auth.UserProfile` or auth organization data through a dual-read/write migration.

## Decisions

### Decision: Main creates `User` only after verified email and slug submission

Email/password registration will create an auth account and auth session, then force email verification. Main `User` is not created until the user submits the main account setup form with display name and slug after verification.

Third-party registration skips the email verification step only when auth reports a trusted verified provider email. The user then submits display name and slug to main, and main creates the `User`.

Rationale:

- `server.User.slug` remains the only slug uniqueness source.
- Main avoids half-created users, Meilisearch documents, shelves, default realm membership, and cleanup work for unverified accounts.
- Failed or abandoned email verification can be cleaned up entirely in auth.

Alternatives considered:

- Create main `User` immediately with a `pendingVerification` state. Rejected because every main-domain feature would need to tolerate semi-users and clean them up.
- Reserve slug in a separate table before user creation. Rejected because the user explicitly wants main `User.slug` to be the uniqueness authority.
- Keep `auth.UserProfile` until verification completes. Rejected because it continues the split-brain ownership problem.

### Decision: Auth-only pending users are locked into registration completion

After sign-up or pending-account login, the frontend will render only the registration completion flow until one of these happens:

- email verification succeeds and the user moves to main account setup,
- main account setup succeeds and main issues `rezics-session-token`,
- the user pauses registration through sign-out,
- auth cleanup later deletes stale temporary accounts if they never complete.

Rationale:

- There is no main `User` to hydrate headers, profile, shelves, permissions, or member-only APIs.
- A locked flow is clearer than a partial logged-in header with missing data.
- Pause registration gives the user an explicit escape without pretending they are a full member.

Alternatives considered:

- Let pending users browse guest pages. Rejected because the UI would need an auth-only identity state with no main user and unclear header/profile behavior.
- Treat pending users as anonymous after sign-up. Rejected because resend/re-entry require an auth session and pending account context.

### Decision: Pausing registration is non-destructive sign-out

The frontend pause action will call the normal sign-out boundary. Main clears browser main session cookies if present, auth invalidates the current browser session, and the frontend clears local auth/profile state before returning to anonymous navigation.

The temporary auth account remains intact. Later sign-in with the same account resumes the pending verification or setup step. Stale temporary accounts are handled by scheduled/admin cleanup, not by the user-visible pause action.

Rationale:

- Pause should not destroy account state or make the user restart registration.
- The browser cannot clear httpOnly auth cookies purely in frontend state, so normal sign-out is the correct non-destructive escape hatch.

Alternatives considered:

- Delete or disable auth user from the user-visible pause action. Rejected because the desired product behavior is to allow the same account to continue registration later.
- Hard-delete auth user from the frontend. Rejected because it bypasses main-owned product policy and internal auth cleanup rules.

### Decision: Login/register re-entry resumes pending registration

When a user logs in or attempts to register with an email that maps to an existing unverified temporary auth account, the system will restore an auth session and return a normalized pending-registration state. The frontend will route to the locked verification screen until verification, account setup, pause/sign-out, or stale-account cleanup.

Rationale:

- This avoids duplicate auth accounts for one email.
- It makes resend and recovery deterministic.
- It gives the product a clear answer to "what happens if I close the tab and come back tomorrow?"

Alternatives considered:

- Return "email already registered" and require password reset/support. Rejected as poor UX for normal registration interruption.
- Silently create another account. Rejected because auth email uniqueness prevents it and it would be unsafe for provider linking.

### Decision: Auth organization is removed; future developer orgs live in main

Auth organization tables and routes are no longer product-facing. If Rezics needs teams for OAuth client ownership, app review, or developer collaboration, main will define those product entities and authorize changes with main permissions. Auth will keep only the OAuth client/token/consent protocol records required for standards behavior.

Rationale:

- Team membership is product/account state, not authentication state.
- Main must authorize app ownership and review decisions anyway.
- It avoids leaking better-auth organization semantics into product UX.

Alternatives considered:

- Keep auth organizations just for OAuth app ownership. Rejected because auth organizations cannot see main permissions, account status, or product review state without coupling.
- Duplicate developer organizations in both services. Rejected because it creates another split-brain ownership model.

### Decision: Main account setup endpoint atomically creates the Rezics user

The main account setup endpoint will:

1. Validate the opaque auth session with auth.
2. Require trusted/verified email state.
3. Reject if a main user already exists for the auth user.
4. Validate slug format.
5. Insert `User` with `authUserId`, email snapshot, display name, and slug.
6. Rely on main database uniqueness for `User.slug` and `authUserId`.
7. Bootstrap system shelves, default realm membership, and Meilisearch sync using existing main services.
8. Sign and set `rezics-session-token`.

Rationale:

- All product-side account creation side effects are under one transaction boundary where practical.
- Slug conflict handling is simple: return a conflict from main and let the user choose another slug.
- The frontend can treat success as the transition from pending registration to full member.

Alternatives considered:

- Let auth call `/internal/users/provision` after verification. Rejected because auth would need to know product slug/name choices.
- Keep `/session/exchange` as the user creation fallback. Rejected because exchange is a session refresh concern, not product account creation.

### Decision: Verification email/OTP is hardened before the flow depends on it

The registration flow depends on verification delivery. The implementation must inspect and fix current verification email behavior, including:

- correct templates and SMTP configuration,
- successful resend after cooldown,
- visible failure messages when delivery fails,
- Turnstile failure handling,
- correct auth presence cookie/session behavior after OTP verification,
- tests for pending-account re-entry and resend.

Rationale:

- A locked verification screen is only acceptable if resend and failure recovery are reliable.
- Email delivery bugs become registration blockers under the new flow.

Alternatives considered:

- Keep email verification as best-effort and let main create users first. Rejected because it reintroduces pending main users and cleanup burden.

## Risks / Trade-offs

- [Risk] Pending auth accounts can accumulate if users never verify email. → Mitigation: add auth cleanup for old unverified temporary users.
- [Risk] Users may feel blocked after sign-up if email delivery fails. → Mitigation: show delivery errors, resend cooldown, alternate pause/sign-out action, and admin/test coverage for mailer behavior.
- [Risk] Provider email trust differs across Google, GitHub, Reddit, and future providers. → Mitigation: auth remains the authority for `emailVerified`; untrusted/missing provider email goes through OTP before main setup.
- [Risk] Slug conflict happens after email verification. → Mitigation: main account setup returns conflict and keeps the user on setup without losing verified auth state.
- [Risk] Removing auth organization breaks admin pages or OpenAPI docs that still expose those endpoints. → Mitigation: update admin/API surfaces and remove auth organization routes in the same breaking cutover.
- [Risk] Existing tests assume registration can browse as guest-auth state. → Mitigation: update frontend auth state tests and route guards around locked pending registration.
- [Risk] Main session refresh currently provisions users. → Mitigation: replace refresh fallback with explicit "main user missing" responses and route the frontend to setup.

## Migration Plan

1. Add main-owned registration state contracts and account setup/pause route specs.
2. Remove `auth.UserProfile` and auth organization usage from contracts, OpenAPI routers, frontend API clients, and admin pages.
3. Update auth schema/migrations to remove unused profile/organization tables or leave them ignored only for one migration cycle if Prisma requires staged removal.
4. Add main user fields needed to bind auth identity (`authUserId`, email snapshot, verification timestamp/source as needed).
5. Implement auth pending-registration detection, verification resend/error response normalization, and cleanup for stale unverified auth accounts.
6. Implement main account setup endpoint and non-destructive pause/sign-out behavior.
7. Update frontend registration/login/provider callback flows to lock auth-only users into verification/setup.
8. Update `/auth/session/refresh` and browser auth middleware so main session cookies work consistently and no fallback user creation occurs.
9. Run focused tests across `package/auth`, `package/server`, `package/api`, and `package/app`, then remove stale onboarding/profile sync code.

Rollback strategy:

- This is a development-stage breaking change. Rollback is a code/schema revert plus database reset or restore from pre-migration backup. No dual-write compatibility mode is planned.

## Open Questions

- How should stale unverified auth accounts be surfaced to admins before cleanup, if at all?
- How long should stale unverified auth accounts live before cleanup: 24 hours, 7 days, or another product policy?
- Should provider-trusted email be stored in main as `emailVerifiedAt` plus `emailVerificationSource`, or only as `email` with auth remaining the verification authority?
- Should Reddit be added as an external provider in the same implementation, or should this change only make the provider-linking model ready for it?
