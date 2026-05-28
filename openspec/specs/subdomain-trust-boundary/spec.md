# subdomain-trust-boundary Specification

## Purpose

Defines the security boundary that lets first-party services
under `*.rezics.com` share the `rezics-session-token` cookie.
Owns the production cookie attributes
(`Domain=.rezics.com; Path=/; HttpOnly; SameSite=Lax; Secure`)
and the localhost variant, logout symmetry, the prohibition on
untrusted content (uploaded HTML, third-party widgets) under any
first-party origin, DNS hygiene against dangling CNAMEs, the
first-party XSS = session-compromise rule with per-service CSP,
and the credentialed CORS allow-list shape.

## Requirements

### Requirement: Session cookie scoped to registrable domain

In production, the `rezics-session-token` cookie SHALL be set with `Domain=.rezics.com`, `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure`. In development (when the host is `localhost`), the cookie SHALL be set without a `Domain` attribute (host-only on localhost), with `Path=/`, `HttpOnly`, and `SameSite=Lax`; `Secure` is omitted because browsers permit non-secure cookies on `localhost`.

The cookie scope SHALL allow all first-party services running under `*.rezics.com` (and `localhost:*` in dev) to receive the session cookie on browser-mediated requests under the SameSite=Lax policy, since `book.rezics.com`, `notify.rezics.com`, etc. share the registrable domain `rezics.com` and are therefore same-site.

#### Scenario: Production cookie carries Domain attribute

- **WHEN** a successful login response is issued in production
- **THEN** the `Set-Cookie` header for `rezics-session-token` includes `Domain=.rezics.com`, `Path=/`, `HttpOnly`, `SameSite=Lax`, `Secure`

#### Scenario: Development cookie omits Domain attribute

- **WHEN** a successful login response is issued in development against localhost
- **THEN** the `Set-Cookie` header for `rezics-session-token` does not include a `Domain` attribute, includes `Path=/`, `HttpOnly`, `SameSite=Lax`, and does not include `Secure`

#### Scenario: Same-site cross-origin request carries cookie

- **WHEN** the browser is at origin `https://book.rezics.com` and a `fetch` is issued to `https://notify.rezics.com/notification/list` with `credentials: 'include'`
- **THEN** the browser includes the `rezics-session-token` cookie on the request because the two origins are same-site (eTLD+1 = `rezics.com`) and `SameSite=Lax` permits same-site cross-origin requests

#### Scenario: Cross-site request from third party blocked

- **WHEN** an attacker page at `https://evil.com` triggers a `fetch` to `https://notify.rezics.com/notification/read-all` with `credentials: 'include'`
- **THEN** the browser does NOT include the `rezics-session-token` cookie because `SameSite=Lax` blocks cookie inclusion on cross-site requests for non-safe methods, and the request is rejected as unauthenticated

### Requirement: No untrusted content on first-party origins

No `*.rezics.com` subdomain (including `rezics.com` itself) SHALL host user-uploaded HTML, third-party widgets, embedded iframes from external authors, file gists, or any other content that allows untrusted JavaScript to execute. User-generated content that requires script execution SHALL be hosted on a separate registrable domain (the `googleusercontent.com` pattern).

This invariant is required because the `Domain=.rezics.com` cookie scope means any first-party origin's JavaScript can issue authenticated requests to any first-party service. `HttpOnly` prevents token theft but does not prevent session abuse.

#### Scenario: User-uploaded HTML blocked from first-party origin

- **WHEN** a feature requires hosting user-authored HTML or arbitrary user JavaScript
- **THEN** the feature SHALL serve that content from a separate registrable domain (e.g., `rezics-usercontent.com`), and SHALL NOT host it under any `*.rezics.com` subdomain

#### Scenario: Third-party widget audit

- **WHEN** a third-party widget, analytics script, or embedded service is proposed for inclusion on a first-party page
- **THEN** the proposal SHALL be reviewed against this invariant; widgets that load arbitrary JavaScript are subject to subresource integrity (SRI) and CSP review

### Requirement: DNS hygiene for first-party subdomains

DNS records for `*.rezics.com` SHALL be audited periodically against the live service inventory to detect dangling CNAMEs that point to deprovisioned services (Heroku, Vercel, Render, S3 buckets, etc.). A dangling CNAME on a `*.rezics.com` subdomain that points to an unclaimed third-party service can be claimed by an attacker, who then controls a first-party origin and inherits the cookie trust.

#### Scenario: Subdomain audit cadence

- **WHEN** a service is decommissioned and its `*.rezics.com` CNAME is no longer in use
- **THEN** the CNAME SHALL be removed from DNS as part of the decommissioning checklist, before the third-party deployment is deleted

#### Scenario: Takeover detection

- **WHEN** automated DNS monitoring (e.g., a subdomain takeover scanner) detects a dangling CNAME pointing to an unclaimed third-party service
- **THEN** the alert SHALL be treated as a security incident and the CNAME removed or repointed within 24 hours

### Requirement: Logout symmetry

Logout SHALL clear the `rezics-session-token` cookie using the same `Domain` attribute that session creation used. In production this means issuing `Set-Cookie: rezics-session-token=; Domain=.rezics.com; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`. Failing to include the `Domain` attribute on the clear leaves the cookie alive on sibling subdomains.

#### Scenario: Production logout clears cookie everywhere

- **WHEN** a user logs out in production
- **THEN** the `Set-Cookie` header for cookie deletion includes `Domain=.rezics.com` and `Max-Age=0`, ensuring the cookie is removed from every `*.rezics.com` first-party origin in the same browser session

#### Scenario: Development logout omits Domain attribute

- **WHEN** a user logs out in development against localhost
- **THEN** the `Set-Cookie` header for cookie deletion omits the `Domain` attribute (matching session creation) and includes `Max-Age=0`

### Requirement: First-party XSS remains session-equivalent

This trust boundary spec does not mitigate cross-site scripting (XSS) on first-party origins. An attacker who achieves XSS on any `*.rezics.com` origin SHALL be assumed to have full session access for that user, because client-side JavaScript can issue authenticated requests to any first-party service whether or not it can read the cookie itself. Standard XSS defenses (Content Security Policy, escape-on-render, React's automatic escaping, audit of `dangerouslySetInnerHTML`) SHALL apply per service.

#### Scenario: CSP per service

- **WHEN** a first-party service serves HTML or HTML-like responses
- **THEN** the service SHALL respond with a Content Security Policy header appropriate to its content (script-src, style-src, frame-ancestors, connect-src), and SHOULD use nonce or hash-based script allowlisting rather than `'unsafe-inline'`

#### Scenario: dangerouslySetInnerHTML audit

- **WHEN** a React component uses `dangerouslySetInnerHTML`
- **THEN** the source of the inner HTML SHALL be either (a) trusted server-rendered content, or (b) sanitized via a vetted sanitizer (e.g., DOMPurify) configured to strip script-loading constructs

### Requirement: First-party CORS allow-list shape

First-party services that accept authenticated cross-origin requests from browsers SHALL configure CORS with `credentials: true` and a non-wildcard origin allow-list that matches `https://*.rezics.com` (and `https://rezics.com`). Wildcard `*` origin SHALL NOT be used in combination with `credentials: true` (browsers reject this combination).

#### Scenario: Notify CORS allows first-party origins with credentials

- **WHEN** a `fetch` from `https://book.rezics.com` is issued to `https://notify.rezics.com/notification/list` with `credentials: 'include'`
- **THEN** notify responds with `Access-Control-Allow-Origin: https://book.rezics.com` (echoing the request origin) and `Access-Control-Allow-Credentials: true`, and the browser accepts the response

#### Scenario: Cross-site origin rejected by CORS

- **WHEN** a `fetch` from `https://evil.com` is issued to `https://notify.rezics.com/notification/list` with `credentials: 'include'`
- **THEN** notify does NOT include `Access-Control-Allow-Origin` for `evil.com` in the response, and the browser blocks JavaScript access to the response body
