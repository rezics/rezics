# exchange-auto-provision Specification

## Purpose

This capability has been retired. The `POST /session/exchange` endpoint and its JWT-in-header auto-provisioning path were deleted by the `auth-identity-session-cleanup` change. Provisioning is now handled exclusively by:

- The cookie-boundary path (`materializeMainAccountFromAuth` / `refreshMainSessionFromAuth`) which derives identity from the validated auth session cookie, defined under `opaque-auth-session-refresh` and `main-owned-account-registration`.
- The auth-side `afterSignUp` / verify-email path calling main's internal provisioning endpoint when configured, defined under `auth-user-provisioning-hook`.
- The auth-presence cookie behavior on session-establishing paths is owned by `cross-site-auth-presence` and `opaque-auth-session-refresh`.

No client SHALL depend on auto-provisioning via JWT exchange. The legacy `provisionFromJwt` helper is deleted along with `/session/exchange`.

## Requirements

(No active requirements — see capabilities listed under Purpose for the surviving behavior.)
