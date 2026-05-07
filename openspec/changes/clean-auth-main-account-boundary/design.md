## Context

Rezics now has an independent auth service and a main product server, but the account boundary is still blurred.

Current state:

- Auth owns credentials, provider accounts, sessions, email verification, OTP, OAuth/OIDC protocol records, and better-auth user rows.
- Main owns Rezics `User`, slug uniqueness, profile data, product permissions, shelves, realm membership, search sync, and `rezics-session-token`.
- Main `User` currently stores `email`, `emailVerifiedAt`, and `emailVerificationSource`.
- Auth `User` also stores `email`, `emailVerified`, and `name`.
- Registration currently combines verified auth state, main user creation, slug selection, product bootstrap, and member token issuance too tightly.

The target model treats auth as replaceable identity infrastructure and main as the product account authority. Main validates auth session state when needed, but main product data must not depend on better-auth-specific profile semantics.

## Goals / Non-Goals

**Goals:**

- Make auth login email and main Rezics email separate concepts even though both fields are named `email` in their own tables.
- Keep `server.User.email` as the product/main email and write only verified values into it.
- Remove generic auth verification columns from main `User`.
- Add main-owned email verification contract records for product email fields.
- Use existing `@rezics/email` for shared nodemailer sender creation without making main own a separate mailer stack.
- Make `server.User.slug` canonical and auth-side slug/name a one-way login projection.
- Split registration verification from profile setup and member readiness.
- Avoid general capability checks on normal member APIs by using separate token/cookie types and route guards.
- Separate login email settings from Rezics product email settings in the frontend.
- Keep normal member routes on the existing `requireLogin` shape where practical.

**Non-Goals:**

- General fine-grained capability authorization.
- Backward-compatible dual-write migration.
- Making auth own Rezics display name, product email, slug authority, or product permissions.
- Allowing auth-only users to access main product APIs during registration verification.

## Decisions

### Decision: Shared email sender lives in `@rezics/email`

The existing `package/email` package will own reusable nodemailer sender creation alongside templates/rendering. It will expose a function that accepts explicit transport and sender config.

`@rezics/email` SHALL NOT read process env. Each caller reads its own env, validates it locally, and passes the resulting config into the sender:

```txt
auth env  -> @rezics/email sender
server env -> @rezics/email sender
notify env -> @rezics/email sender
```

Main product email verification may use this shared sender, but main does not gain an independent auth-style mail subsystem. Delivery errors remain synchronous/typed for verification flows.

Main server env documentation will use `MAIN_EMAIL_FROM_EMAIL` and `MAIN_EMAIL_FROM_NAME` for product email sender identity, alongside SMTP transport values.

Rationale:

- Keeps email delivery implementation reusable without creating env coupling between services.
- Lets auth keep auth-specific senders and main keep product-email sender config.
- Avoids misusing notification fanout for verification flows that need typed delivery failures.

Alternatives considered:

- Let main call auth to send all product email verification messages. Rejected because main product email is not auth login email, and auth should not own product contact fields.
- Use notify's fire-and-forget email fanout for verification. Rejected because verification flows must know whether delivery failed.
- Duplicate nodemailer setup in every service. Rejected because `@rezics/email` already exists and should own shared email rendering/sending utilities.

### Decision: Keep both `email` column names but define different ownership

`auth.User.email` remains the login email. It is used for credentials, account recovery, provider linking, auth verification, and auth session claims.

`server.User.email` remains named `email`, but it means Rezics product/main email. It may be initialized from the verified auth login email during user materialization. After that, it is not automatically synchronized with auth login email.

Rationale:

- Keeping the main column name avoids making product code awkward with names like `profileEmail` everywhere.
- Documentation and schema comments can establish the semantic boundary.
- Login email changes and product email changes have different product meanings.

Alternatives considered:

- Rename main field to `profileEmail`. Rejected because the user wants `email` to remain the product-facing primary email name.
- Keep one synchronized email across auth and main. Rejected because auth login email and product email have different ownership and change flows.

### Decision: Main stores product email verification as a contract record, not on `User`

Main will add an email verification contract table keyed by:

```txt
contractName + ownerId + email
```

Examples:

```txt
("user.email", userId, email)
("org.email", orgId, email)
```

The `User.email` value is updated only after the relevant contract record is verified. Pending email changes remain in the verification contract table and do not overwrite `User.email`.

Rationale:

- This supports future product email fields without baking every verification state into each domain table.
- It avoids ambiguous `User.emailVerifiedAt` semantics.
- It keeps main-owned product email verification separate from auth-owned login email verification.

Alternatives considered:

- Store `emailVerifiedAt` directly on `User`. Rejected because it is ambiguous with auth login verification.
- Delegate all product email verification state to auth. Rejected because main product emails are not auth login identifiers.

### Decision: Registration verification is auth-only

Until required registration verification completes, the browser has only auth-owned state. Main does not create a `User`, does not issue any main token, and normal main product APIs remain unavailable.

Main may proxy public `/auth/*` verification routes, but auth owns the verification mutation. Main user materialization happens only after auth can provide verified registration facts.

Rationale:

- Avoids half-created main users for unverified accounts.
- Keeps shelves, realm membership, search sync, and product permissions out of incomplete auth-only state.
- Makes cleanup of abandoned registration an auth-only concern.

Alternatives considered:

- Create a pending main user before verification. Rejected because every product domain would need to tolerate semi-users.
- Allow guest browsing while auth-only. Rejected for this registration flow because it complicates app chrome and profile hydration.

### Decision: Profile setup uses a separate main token

After registration verification succeeds, main may create a minimal `User` and issue `rezics-profile-setup-token`. This token is accepted only by profile setup routes. It is not accepted by normal `requireLogin` member APIs.

Normal member state uses `rezics-session-token`. That token has no broad capability list; its existence means the caller is member-ready.

The default `rezics-profile-setup-token` TTL will be 15 minutes. If it expires while the auth session is still valid and the main user is still in profile setup state, main may reissue a fresh setup token after validating auth state.

Rationale:

- Avoids adding per-handler capability checks to reaction, shelf, post, notify, and other normal member APIs.
- Lets the profile completion route authenticate the newly materialized main user.
- Keeps normal route guards simple and member-only.
- Limits stolen setup-token usefulness without making normal registration completion fragile.

Alternatives considered:

- Add `capability: "PROFILE_SETUP"` to normal `rezics-session-token`. Rejected because it would force every member route or middleware to reason about partial sessions.
- Keep no main token during profile setup. Rejected because profile setup needs a main user identity after materialization.
- Use a much longer setup token TTL. Rejected because a stolen setup token can still claim slug/name/avatar for the newly materialized identity.

### Decision: Frontend settings separates login email from Rezics email

The Security settings area owns auth login email, password, active sessions, and provider/security controls. The Account/Profile settings area owns Rezics product email, visibility/contact semantics, and main email verification.

Rationale:

- Login email and Rezics email have different ownership and side effects.
- Keeping both under one generic "Email" section would recreate the boundary confusion in the UI.
- Password and login email belong together because both affect authentication and recovery.

Alternatives considered:

- Keep a single Account email UI. Rejected because it hides the distinction between auth login email and main product email.
- Rename the database column to `profileEmail` to match UI. Rejected because the main product field should remain `email` in code/schema, with UI copy clarifying semantics.

### Decision: Slug is main canonical and auth alias is one-way projection

`server.User.slug` is the canonical Rezics slug. Auth stores slug only if needed for login, and `auth.User.name` is a technical auth label populated from the main slug when better-auth requires a name.

Admin-only slug changes happen in main. After committing the canonical change, main notifies auth to update the login alias and technical auth name.

Rationale:

- Main owns product identity and slug uniqueness.
- Auth can be replaced without changing product user identity.
- A one-way projection avoids bidirectional synchronization.

Alternatives considered:

- Let auth own username/slug login identity. Rejected because slug is also Rezics public product identity.
- Make slug fully immutable. Rejected because admin repair/rename is a valid product operation, even if rare.

### Decision: Public account-stage cookie is a frontend hint only

Frontend may read a non-httpOnly account-stage hint cookie to route quickly:

```txt
registration-verify
profile-required
member
```

The cookie is not authoritative. Frontend must confirm state through server probes, auth session state, or main token validation.

Rationale:

- Improves routing without making security depend on mutable browser state.
- Avoids UI flashes while preserving server-side authority.

Alternatives considered:

- Use only server probes. Rejected as potentially slower and flickery.
- Trust the readable cookie. Rejected because users can edit it.

## Target Flow

```txt
1. Anonymous sign-up/login
   browser -> main /auth/*
   main proxies auth-owned sign-up/login
   auth creates auth session
   public hint: registration-verify
   no main User

2. Registration verification
   browser -> main /auth/* verification route
   main proxies auth-owned verification
   auth verifies login email or future registration factor
   no main User yet

3. Main materialization
   browser -> main account materialization route
   main validates auth session internally
   auth returns verified registration facts: subject, email, future phone
   main creates minimal User with verified email
   main issues rezics-profile-setup-token
   public hint: profile-required

4. Profile setup
   browser -> main profile setup route with rezics-profile-setup-token
   user submits slug, optional name/avatar
   if name is blank, main uses slug as display name
   main validates slug uniqueness
   main marks User member-ready
   main bootstraps shelves, realm membership, search sync
   main projects slug to auth login alias / auth.User.name
   main clears setup token and issues rezics-session-token
   public hint: member
```

## Integration Points

- `package/auth`
  - Continue owning login email, verification, sessions, provider links, and better-auth user rows.
  - Expose verified registration facts to main through internal/session-state APIs.
  - Accept main-originated slug alias projection updates.
- `package/email`
  - Own shared nodemailer sender creation and sender formatting utilities.
  - Keep env-free APIs; callers pass validated config.
- `package/server`
  - Own main email, email verification contract rows, canonical slug, minimal/profile-ready user states, setup token, member token, and route guards.
  - Remove auth verification columns from `User`.
  - Read server SMTP/product sender env and pass config to `@rezics/email`.
- `package/contract`
  - Define account state, email verification contract request/response schemas, profile setup token semantics, and typed errors.
- `package/api`
  - Expose query/mutation helpers for registration state, main materialization, profile setup, and main email change verification.
- `package/app`
  - Route by authoritative state, using account-stage cookie only as a hint.
  - Keep auth-only registration in verification UI, profile setup users in profile completion UI, and member users in normal app chrome.
  - Separate Security login email UI from Account/Profile Rezics email UI.
- `package/admin`
  - Use main-owned slug update routes for admin slug changes and surface projection status/errors when needed.

## Risks / Trade-offs

- [Risk] Two fields named `email` can still confuse maintainers. -> Mitigation: add schema comments, README boundary docs, and tests that prove no automatic sync.
- [Risk] Separate setup token adds another cookie and verifier. -> Mitigation: keep it narrow, short-lived, and accepted by only one guard.
- [Risk] Auth slug alias projection can fail after main slug change. -> Mitigation: use transactional outbox/retry or store projection status for admin repair.
- [Risk] Minimal main user before profile completion may require product code to check status. -> Mitigation: normal member APIs reject setup token and `requireLogin` remains member-only.
- [Risk] Email verification contract table may duplicate some auth verification behavior. -> Mitigation: constrain it to product email fields only; auth keeps login email verification.
- [Risk] Shared sender could accidentally centralize env access. -> Mitigation: require `@rezics/email` to accept explicit config and keep env validation in each caller package.
- [Risk] Users may pause on profile setup longer than 15 minutes. -> Mitigation: reissue setup token from a valid auth session while the user remains profile-setup-required.

## Migration Plan

1. Add docs and contract comments clarifying auth login email vs main email.
2. Add shared nodemailer sender creation to `@rezics/email`.
3. Complete server env validation/docs for SMTP transport and product sender values.
4. Add main email verification contract model and APIs.
5. Remove `emailVerifiedAt` and `emailVerificationSource` from main `User` and update callsites.
6. Add explicit user account status for profile setup/member-ready.
7. Add profile setup token signing, verification, cookie handling, renewal, and route macro.
8. Split account materialization from profile setup.
9. Update frontend state and routes to use account-stage hint plus authoritative probes.
10. Split frontend settings into Security login email/password and Account/Profile Rezics email.
11. Add auth slug alias projection route/client and admin slug update flow.
12. Remove stale tests/fixtures that assume setup immediately creates member-ready users.

Rollback is a code/schema revert plus development database reset or restore. No compatibility mode is planned.

## Open Questions

- None.
