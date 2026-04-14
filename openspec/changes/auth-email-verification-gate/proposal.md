## Why

The current auth flow provisions a server-side user record immediately on sign-up (`user.create.after` hook) and unconditionally exchanges the auth identity token for a session token — even when the user's email has not been verified. This means the server DB contains user records for unverified accounts, and the frontend throws an error on registration because the exchange succeeds but the user hasn't completed verification. The identity token already carries `email_verified: false` when unverified, but nothing in the pipeline acts on it.

## What Changes

- **Guard the provisioning hook**: The existing `user.create.after` database hook in `@rezics/auth` will skip server provisioning when `emailVerified` is false, deferring it to after verification. Social/OAuth sign-ups (where `emailVerified` is already true at creation) continue to provision immediately.
- **Add verify-email middleware**: A post-response middleware in the auth request handler (`routes.ts`) will detect successful email verification responses and trigger user provisioning at that point.
- **Extract provisioning logic**: The provisioning fetch call will be extracted into a shared function so both the hook and the middleware call the same code.
- **Guard token exchange on the frontend**: `exchangeForSessionToken()` will check the identity token claims and return `null` early when `email_verified === false`, preventing a pointless (and failing) server call.
- **Tolerate missing session token**: `login()` and `register()` in the frontend handler will no longer throw when the exchange returns `null` due to an unverified email — they will hydrate auth state and let the verification page take over.
- **Persist `email_verified` in localStorage**: `writeAuthSnapshot()` will include the `email_verified` field so persisted state is consistent with derived state.
- **Fix verify-email refresh flow**: The "Refresh" button on the verify-email page will force-fetch a new identity token from the auth service before hydrating state, so updated claims (with `email_verified` removed) are picked up.

## Capabilities

### New Capabilities

- `email-verification-gate`: Guards that prevent token exchange and user provisioning until email verification is confirmed, plus the middleware that triggers deferred provisioning after verification.

### Modified Capabilities

- `auth-user-provisioning-hook`: The hook now conditionally skips provisioning for unverified emails.
- `auth-token-lifecycle-provider`: The token exchange and refresh flows change to respect email verification status.

## Impact

- **`@rezics/auth`**: `instance.ts` (provisioning hook guard), `routes.ts` (verify-email middleware), new shared provisioning utility.
- **`@rezics/api`**: `react-query/jwt.ts` (exchange guard, `writeAuthSnapshot` field addition), `state/authSessionStore.ts` (no structural change — `deriveNeedsVerification` already works).
- **`@rezics/app`**: `user/model/handler.ts` (login/register error handling), `user/page/VerifyEmailPage.tsx` (refresh flow fix).
- No database migrations. No breaking API changes. No changes to `@rezics/contract` (the `email_verified` claim schema already supports this).
- Backward-compatible: existing verified users are unaffected. Unverified user records already in the server DB from prior sign-ups remain valid (the provisioning upsert is idempotent).
