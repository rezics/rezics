## Context

Rezics properties under the same root domain can share auth cookies from `package/auth`, but current frontend flows still discover that shared login state by calling `/api/auth/token` or `/api/auth/get-session-state`. In `package/app-shell/src/provider/AuthProvider.tsx`, hydration and refresh scheduling happen eagerly on startup, visibility changes, and token storage events. In `package/api/src/react-query/http.ts`, any protected API `401` also triggers token refresh. This means a user navigating across multiple Rezics sites can produce repeated auth traffic even when a page only needs to know whether login is possible.

The requested behavior is narrower than full authentication: browser JavaScript needs a low-cost signal that a root-domain auth session probably exists, without exposing access tokens or refresh tokens. The same change set also introduces a shared `package/ui` component for cookie-consent messaging so product surfaces can request cookie policy acceptance consistently.

This is a cross-package change spanning `package/auth`, `package/contract`, `package/api`, `package/app-shell`, and `package/ui`, with security and rollout implications.

## Goals / Non-Goals

**Goals:**

- Add a root-domain, JS-readable auth-presence signal that indicates whether the auth backend currently sees a signed-in browser session.
- Gate JWT bootstrap and retry behavior on that presence signal so clients do not refresh tokens when there is no shared login state to recover.
- Preserve current bearer-token flows and auth-session APIs for pages that truly need authenticated state.
- Provide a reusable cookie-consent UI component from `package/ui` with accessible structure, customizable copy, and host-managed acceptance handling.

**Non-Goals:**

- Replacing HttpOnly auth cookies with JS-readable credentials.
- Guaranteeing the presence signal is authoritative for authorization decisions.
- Building a full consent-preference center or category-by-category cookie management flow.

## Decisions

### 1. Represent cross-site login state with a JS-readable presence cookie

`package/auth` will mint a lightweight root-domain cookie such as `rezics_open_session=1` whenever a browser session is successfully established or confirmed, and it will clear that cookie on sign-out or when session validation fails. The cookie will be readable by JavaScript, omit bearer material, and carry only presence metadata needed for fast detection.

Rationale:

- Reading `document.cookie` is effectively free compared with network-based session probing.
- A cookie can be scoped to the shared root domain, which fits the multi-site login requirement better than `localStorage`.
- A separate presence cookie preserves the security boundary of existing HttpOnly auth cookies and JWT issuance.

Alternatives considered:

- Add a `/api/auth/presence` endpoint and call it on page load. Rejected because it still introduces a request on every surface that wants a cheap presence check.
- Reuse the existing session cookie directly. Rejected because the session cookie should remain HttpOnly and unavailable to JS.
- Mirror state through `localStorage`. Rejected because it does not cross origins/subdomains reliably.

### 2. Treat presence as a hint, not authentication

Frontend code will use the presence cookie only to decide whether it is worth attempting token bootstrap or refresh. Authorization for API calls will still depend on JWT possession and backend verification. If presence exists but token acquisition fails, clients will clear business-token state, avoid tight retry loops, and rely on the next user action or explicit visibility refresh to re-check presence.

Rationale:

- Presence can become stale if the auth session expires in another tab or service.
- Keeping presence non-authoritative avoids accidental privilege escalation through client-side assumptions.

Alternatives considered:

- Trust presence as equivalent to a logged-in member state. Rejected because it would blur the line between “session may exist” and “valid JWT acquired.”

### 3. Centralize presence-aware bootstrap in shared API/app-shell helpers

`package/api` will expose helpers for reading and clearing auth presence, and `queryAccessToken()` plus the generic API retry path will consult those helpers before fetching `/api/auth/token`. `package/app-shell` will use the same helpers before hydrating session state or scheduling refresh work.

Rationale:

- The current eager refresh behavior is split between bootstrap logic and retry logic; gating only one path would leave wasteful requests in the other.
- Keeping presence logic in shared helpers prevents each app from inventing inconsistent cookie parsing.

Alternatives considered:

- Let each app decide when to inspect presence. Rejected because the waste originates in shared infrastructure, so the fix should live there too.

### 4. Make cookie consent a reusable, host-controlled UI component

`package/ui` will add a composite component, for example `CookieConsentBanner`, that renders consent copy, a policy link, and primary/secondary actions. The component will be controlled by props so host apps decide when it appears, how acceptance is persisted, and which policy URL/copy to use. The component will satisfy accessibility basics: semantic landmark or dialog structure, keyboard-focusable actions, and screen-reader-readable labels.

Rationale:

- Consent persistence and legal copy can vary by site, while layout and interaction should remain consistent.
- A host-controlled component fits the existing `package/ui` role better than embedding app-specific storage or routing concerns.

Alternatives considered:

- Bundle storage and policy routing inside `package/ui`. Rejected because it would force all consumers into one persistence model and navigation strategy.

## Risks / Trade-offs

- [Presence cookie becomes stale] -> Clear it on explicit sign-out and unsuccessful token bootstrap, and never treat it as authorization.
- [Multiple packages parse cookies differently] -> Add one shared helper in `package/api` and route all presence checks through it.
- [Root-domain cookie configuration differs by environment] -> Keep domain/path/max-age configuration centralized in `package/auth` environment-aware cookie utilities.
- [Consent UX is inconsistent across apps] -> Export one reusable component with clear API boundaries instead of duplicating banners in each app.
- [Presence gating hides legitimate re-auth opportunities] -> Permit explicit user-initiated sign-in and visibility-based rechecks to bypass passive gating when needed.

## Migration Plan

1. Add contract and auth-server support for the open-session cookie lifecycle.
2. Add shared presence helpers in `package/api` and update token bootstrap/retry flows to consult them.
3. Update `package/app-shell` startup and visibility hydration to skip eager auth requests when presence is absent.
4. Add the `package/ui` cookie-consent component and export it through existing barrels.
5. Adopt the new UI component in consuming apps as needed.
6. Roll back by ignoring the presence helper in clients; the existing `/api/auth/token` and session endpoints remain available.

## Open Questions

- What exact cookie name and max-age should be standardized for the presence signal across environments?
- Should successful `get-session-state` responses also refresh the presence cookie lifetime, or only sign-in and token issuance?
- Which app will adopt the new cookie-consent component first, and does it require locale-specific legal copy beyond a generic API surface?
