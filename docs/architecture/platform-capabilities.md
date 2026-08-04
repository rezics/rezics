# Platform capabilities

This document owns the cross-cutting product outcomes that every Rezics
capability builds on. It joins the account, access, localization, media,
communication, operator, and application-shell boundaries without replacing
their local contracts.

Planning context:

- [Outline: access](https://outline.rezics.com/doc/access-2aGvoMGFZp)
- [Outline: API token and OAuth](https://outline.rezics.com/doc/api-token-oauth-7leUXBQW9n)
- [Outline: OAuth](https://outline.rezics.com/doc/oauth-tmEnG4HA06)
- [Outline: i18n support](https://outline.rezics.com/doc/i18n-Lrap9VgvUN)
- [Outline: About](https://outline.rezics.com/doc/about-E20rt9FceW)

## Identity and access

The account boundary is owned by `services/main/src/services/auth`,
`services/main/src/services/api/users`, and `apps/web/features/auth`. Profiles
and account settings are owned by `services/main/src/services/platform-users`,
`apps/web/features/profiles`, and `apps/web/features/settings`.

```progress
id: identity.account-lifecycle
status: open
goal: Give a person a secure, recoverable account lifecycle from registration through sign-out and account closure.
depends: []
accept:
  - Registration, verification, sign-in, sign-out, password recovery, and credential changes use the live API and have localized success and failure states.
  - Session, email-verification, Turnstile, and account-state rules are enforced by the server and cannot be bypassed by a client route.
  - Account suspension, deletion, and recovery have explicit data, audit, and operator behavior.
verify:
  - Run the authentication service and web feature tests.
  - Exercise the account lifecycle against a clean local installation, including invalid, expired, suspended, and recovery cases.
```

```progress
id: identity.profiles-and-settings
status: open
goal: Let each account maintain a public Profile and private preferences without leaking account-only data.
depends:
  - identity.account-lifecycle
accept:
  - A signed-in person can read and update Profile metadata, presentation preferences, content-rating preferences, privacy choices, and security settings.
  - Public Profile pages expose only public activity and content through stable ID and slug routes.
  - Preference defaults, failed reads, cache invalidation, and unsupported values have deterministic behavior.
verify:
  - Run the profile, preference, settings, and public-route tests in the web and main-service workspaces.
  - Create two local accounts and confirm that public and private Profile data remain separated.
```

```progress
id: access.unit-collaboration
status: open
goal: Let Unit owners delegate narrowly scoped collaboration while the server preserves ownership and protection invariants.
depends:
  - identity.account-lifecycle
accept:
  - Owner, manager, collaborator, public, and platform authorities resolve through one typed permission model.
  - Invitations, grants, restrictions, ownership recovery, and protected Unit lifecycle actions are enforced server-side and recorded in the security audit.
  - Every Unit management surface explains why an action is available or refused without treating documentation tags as authorization.
verify:
  - Run the access library, authorization service, governance API, and web access-management tests.
  - Exercise allowed, denied, expired, revoked, and ownership-recovery cases with separate local accounts.
```

```progress
id: developer.api-access
status: open
goal: Give people and integrations revocable API access with understandable scopes, quotas, and credential controls.
depends:
  - access.unit-collaboration
accept:
  - A person can create, inspect, restrict, rotate, and revoke API tokens without exposing stored token secrets.
  - Token and account quota policies are enforced atomically and can be managed only by authorized operators.
  - Scope selection uses the same permission vocabulary for API tokens and OAuth authorization.
verify:
  - Run the auth, token, quota-policy, audit, console, and settings tests.
  - Exercise token creation, quota refusal, scope refusal, rotation, and revocation through the generated API client.
```

The longer-lived third-party authorization result remains tracked by
`auth.third-party-oauth` beside the owning database contract.

## Language, media, and communication

```progress
id: localization.application-and-content
status: open
goal: Present application messages and user-authored localized content through one complete, typed language contract.
depends: []
accept:
  - Every user-visible application string in the web and About applications comes from its typed locale owner.
  - Unit metadata, Post content, moderation notes, notifications, and other translatable domain content preserve source language, available versions, fallback, and display choice.
  - Chinese conversion, locale routing, terminology, invariant terms, and missing translations follow one tested policy.
verify:
  - Run the i18n policy, locale-contract, About locale, content-language, and content-display tests.
  - Audit every persisted user-visible text field and document each intentional non-translatable exception.
```

```progress
id: media.asset-lifecycle
status: open
goal: Provide a secure image and avatar lifecycle from upload through localized presentation and cleanup.
depends:
  - identity.account-lifecycle
accept:
  - An immutable asset identity relates validated source objects, renditions, derivations, checksums, dimensions, formats, ownership, and lifecycle without exposing object-storage credentials.
  - Unit localization images, avatars, emoji, Font Awesome presentations, transformations, and usage references use stable typed contracts with accessible fallbacks.
  - Upload, deduplication, cache behavior, replacement, removal, orphan detection, garbage collection, authorization, and failure recovery are observable and safe.
verify:
  - Run the avatar, image-asset, object, rendition, derivation, usage, storage, media component, proxy-route, and garbage-collection tests.
  - Exercise upload, duplicate upload, transformation, presentation update, unauthorized access, missing object, referenced removal, orphan cleanup, and recovery against local object storage.
```

```progress
id: communication.transactional-email
status: open
goal: Deliver only approved transactional email purposes with safe local behavior and auditable production failures.
depends:
  - identity.account-lifecycle
accept:
  - Verification and password-recovery messages render naturally in every supported locale and contain valid, expiring actions.
  - Local development never delivers externally by default, while production delivery requires explicit Cloudflare configuration.
  - Dispatch retries, terminal failures, suppression, and sensitive-field redaction are observable without duplicate delivery.
verify:
  - Run the email library and main-service email behavior tests.
  - Complete the log-mode and opt-in Cloudflare procedures in `docs/email-delivery.md`, including a forced delivery failure.
```

```progress
id: communication.in-app-notifications
status: open
goal: Give a person a reliable in-app inbox for invitations, moderation, and product activity they have chosen to receive.
depends:
  - identity.profiles-and-settings
accept:
  - Notification producers create deduplicated, localized records with a stable destination and privacy-safe payload.
  - The inbox exposes unread count, pagination, read state, and invitation actions through the live API.
  - Notification preferences stop unwanted future events without corrupting existing records or required security notices.
verify:
  - Run the notification service and web notification tests.
  - Trigger each supported notification purpose and verify unread, read, destination, preference, and duplicate behavior.
```

## Product shell and operator surfaces

```progress
id: experience.application-shell
status: open
goal: Provide a localized, accessible application shell that preserves navigation, session, theme, and recovery state.
depends:
  - identity.account-lifecycle
  - localization.application-and-content
accept:
  - Header, sidebar, account actions, search entry, loading feedback, theme, and responsive navigation compose every application route consistently.
  - Client navigation and session transitions do not leave stale progress, cached identity, or inaccessible focus state.
  - Not-found, forbidden, and unexpected-error pages give a safe localized recovery path.
verify:
  - Run the application-shell, routing, session-boundary, theme, navigation-progress, and status-page tests.
  - Have a maintainer perform frontend acceptance for keyboard, screen-reader, narrow-screen, session-change, and failure journeys.
```

```progress
id: experience.shared-design-system
status: open
goal: Keep every shared product surface on the project-owned SharkUI contract with accessible, predictable composition.
depends:
  - localization.application-and-content
accept:
  - Shared primitives come from the tracked SharkUI mirror and project-owned composites live under `libraries/ui/src/custom`.
  - Product features do not introduce a second component system or bypass typed localization and accessibility contracts.
  - The mirror audit, public exports, styling contract, and consumer builds remain synchronized.
verify:
  - Run the UI mirror audit, UI typecheck, and affected consumer builds.
  - Audit web feature imports and document every intentional direct primitive or style exception.
```

```progress
id: governance.operator-console
status: open
goal: Give authorized operators one auditable console for users, Units, access, quotas, ownership claims, and moderation.
depends:
  - access.unit-collaboration
  - developer.api-access
accept:
  - Every console route and API operation requires the exact platform permission it needs.
  - User, Unit, quota, access, ownership-claim, moderation, and audit views use live data with bounded pagination and actionable failure states.
  - Mutations create security audit records and protect against stale or repeated operator actions.
verify:
  - Run console route-access, platform-access, audit, ownership-claim, quota, and moderation tests.
  - Exercise each console section with an authorized operator and a forbidden ordinary account.
```

```progress
id: governance.ownership-claims
status: open
goal: Let a person claim an unowned Unit through a reviewable, conflict-safe ownership workflow.
depends:
  - access.unit-collaboration
accept:
  - Eligible people can submit and track a claim with the evidence required by the current policy.
  - Authorized operators can approve or reject once, with concurrency, prior ownership, and duplicate claims handled safely.
  - A successful claim changes ownership and audit state atomically and notifies the affected people.
verify:
  - Run the ownership-claim schema, service, API, placement, and console tests.
  - Exercise submit, duplicate, approve, reject, stale-decision, and already-owned cases.
```

```progress
id: experience.about-and-policy-site
status: open
goal: Publish a multilingual About site that explains Rezics by product use case and serves approved policy documents at stable URLs.
depends:
  - localization.application-and-content
accept:
  - The home and product pages explain real Rezics capabilities through product-line and user-journey narratives.
  - Locale negotiation redirects to an available locale and falls back to English when the requested document translation does not exist.
  - Approved legal and instructional documents publish from their canonical source with stable canonical and sitemap metadata.
verify:
  - Run the About check, behavior tests, static build, and built-output tests.
  - Have a maintainer review the home, product, locale fallback, policy, and missing-document journeys before publication.
```

```progress
id: experience.installable-pwa
status: open
goal: Make the main web application safely installable and updateable without serving stale authenticated behavior.
depends:
  - experience.application-shell
accept:
  - The manifest, icons, display mode, and install metadata describe the deployed application accurately.
  - Update and cache policy never preserves stale authenticated API responses or hides a required reload.
  - Unsupported, offline, first-install, update, and recovery states have explicit behavior.
verify:
  - Run the PWA lifecycle and manifest tests and inspect the production build artifacts.
  - Have a maintainer perform install, offline, update, sign-out, and cache-recovery acceptance on supported platforms.
```

```progress
id: release.development-preview-access
status: open
goal: Keep unfinished product surfaces behind explicit development-preview access until their v1 release gates are satisfied.
depends:
  - identity.account-lifecycle
  - access.unit-collaboration
accept:
  - Preview eligibility is decided server-side, exposed through one typed contract, and cannot be granted by client state or an untrusted header.
  - Restricted routes explain the preview state and recovery path without leaking private content or implying production support.
  - V1 release removes the broad preview boundary or replaces it only with explicitly approved capability-specific gates.
verify:
  - Run preview boundary, server eligibility, route access, session transition, and forbidden-state tests.
  - Exercise eligible, ineligible, signed-out, revoked, stale-session, and v1-gate-removal cases.
```

## Platform milestone

```progress
id: platform.v1-foundation
status: open
goal: Make the shared Rezics platform safe and complete enough for every v1 product journey.
depends:
  - identity.account-lifecycle
  - identity.profiles-and-settings
  - access.unit-collaboration
  - developer.api-access
  - localization.application-and-content
  - media.asset-lifecycle
  - communication.transactional-email
  - communication.in-app-notifications
  - experience.application-shell
  - experience.shared-design-system
  - governance.operator-console
  - governance.ownership-claims
  - feedback.toast-audit
  - release.development-preview-access
accept:
  - A new person, contributor, and operator can complete their supported platform journeys without fixture-only data or an undocumented privilege.
  - Identity, authorization, localization, media, communication, feedback, and audit guarantees remain intact across every capability boundary.
  - Supported failure and recovery paths are documented, observable, and exercised before release.
verify:
  - Run the repository typecheck, behavior tests, OpenAPI check, and production build checks.
  - Execute the platform acceptance matrix in a clean installation with ordinary, contributor, and operator accounts.
```
