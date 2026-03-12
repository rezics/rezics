## Why

### Problem

Users can sign in once on one Rezics site and then arrive at other sites under the same root domain with an existing auth session cookie. Today those sites often discover login state by attempting JWT refresh or token acquisition immediately, which creates repeated cross-site auth traffic even when the page only needs to know whether the user is signed in.

### Goals

- Add a lightweight, JS-readable login-state signal from `package/auth` so browser clients can detect whether a root-domain session likely exists before attempting JWT refresh.
- Let shared frontend code refresh JWTs only when the lightweight signal indicates a signed-in user, reducing meaningless requests across Rezics properties.
- Add a reusable `package/ui` component that collects user consent for cookie usage in a consistent, policy-friendly way.

### Non-goals

- Replacing the existing auth session cookie or JWT issuance flow.
- Designing a full legal/compliance policy management system.
- Introducing analytics or marketing-cookie categorization beyond a generic consent surface.

## What Changes

- Add a new auth capability for exposing an open session signal that JavaScript can read without exposing bearer credentials.
- Define frontend behavior for using that signal to decide whether auth clients should attempt JWT refresh or token bootstrap.
- Add a reusable cookie consent UI component in `package/ui`, including consent state display, accept action, and policy-link support.
- Document backward compatibility expectations so existing authenticated flows continue to work when the open session signal is absent or stale.

## Capabilities

### New Capabilities

- `cross-site-auth-presence`: Lightweight root-domain login-state signaling and client refresh gating for multi-site Rezics authentication.
- `cookie-consent-ui`: Shared cookie consent component behavior for Rezics frontend packages.

### Modified Capabilities

- None.

## Impact

### Scope

- `package/auth`: expose and maintain the open session signal alongside current auth session handling.
- `package/api`: add a client-facing API for reading auth presence and adjust token bootstrap logic to use it.
- `package/app-shell`: gate automatic token refresh and auth-session hydration using the presence signal.
- `package/ui`: add exported cookie consent component(s) for reuse by app packages.

### Backward Compatibility

- Existing session cookies and JWT refresh endpoints remain in place.
- Clients that do not adopt the new presence flow can continue using current auth behavior during migration.
- If the open session signal is missing, clients must fall back safely without treating the user as fully authenticated.

### Migration

- Frontend packages that currently refresh JWTs eagerly should migrate to the presence-gated flow.
- Product surfaces that need cookie consent messaging can adopt the new `package/ui` component incrementally.
