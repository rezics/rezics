# notify-system-email Specification

## Purpose

Defines the `notifySystemAndEmail({ userId, kind, payload, locale? })`
fan-out exposed by `@rezics/notify` — one call persists an in-app
notification row and enqueues a localized email for the user's primary
address using the recipient's language fallback chain. Email failures
never block in-app persistence (they flow through the existing
retry/dead-letter path). Also registers the WorkLinkClaim lifecycle
kinds (`WORK_LINK_CLAIM_PENDING` / `_APPROVED` / `_REJECTED`) with their
renderers and the 24-hour per-recipient dedup window on
`WORK_LINK_CLAIM_PENDING`.

## Requirements

### Requirement: notifySystemAndEmail fan-out API

`@rezics/notify` SHALL expose a function `notifySystemAndEmail({ userId, kind, payload, locale? })` that performs both an in-app notification (visible in the user's notification feed) AND an email delivery to the user's primary email address as a single call. The two side-effects SHALL share the same `kind` discriminator and structured payload, so each channel's renderer can format the same data appropriately.

The call SHALL succeed (return without throwing) even if the email channel is temporarily unavailable, provided the in-app notification was persisted. Email failure SHALL be logged and surfaced via the existing email retry / dead-letter mechanism, not propagated to the caller.

#### Scenario: Both channels dispatch from one call

- GIVEN a user "user-a" with a verified primary email address
- AND `kind = "WORK_LINK_CLAIM_PENDING"` is registered in the notify catalog
- WHEN a server-side service invokes `notifySystemAndEmail({ userId: "user-a", kind: "WORK_LINK_CLAIM_PENDING", payload: { claimId, releaseUnitSummary } })`
- THEN exactly one in-app notification row SHALL be persisted for user "user-a"
- AND exactly one email SHALL be enqueued for the user's primary email address
- AND both SHALL carry payload data sufficient to render the message in their respective formats

#### Scenario: Email channel failure does not block in-app delivery

- GIVEN the email channel is temporarily unavailable (transient SMTP failure)
- WHEN a server-side service invokes `notifySystemAndEmail` for a registered kind
- THEN the in-app notification SHALL be persisted successfully
- AND the email SHALL be enqueued (or retried by the existing retry mechanism)
- AND the call SHALL NOT throw

### Requirement: Notification kinds for WorkLinkClaim lifecycle

The notify catalog SHALL register the following kinds, each with a system-feed renderer and an email template:

- `WORK_LINK_CLAIM_PENDING` — sent to the work-side owner when a new pending claim is created.
- `WORK_LINK_CLAIM_APPROVED` — sent to the claimer when their claim is approved.
- `WORK_LINK_CLAIM_REJECTED` — sent to the claimer when their claim is rejected, including any rejection reason.

Each renderer SHALL produce a localized message using the recipient's configured language (with the existing fallback chain: requested → user default → platform `en` → first available).

#### Scenario: Recipient sees the notification in their preferred locale

- GIVEN user "user-a" has `preferredLanguage = "ja"`
- AND `WORK_LINK_CLAIM_PENDING` has Japanese rendering registered
- WHEN a `notifySystemAndEmail({ userId: "user-a", kind: "WORK_LINK_CLAIM_PENDING", ... })` call is processed
- THEN the in-app notification body SHALL be rendered in Japanese
- AND the email body SHALL be rendered in Japanese

### Requirement: Per-recipient deduplication window for claim notifications

For the `WORK_LINK_CLAIM_PENDING` kind, the notify layer SHALL deduplicate emissions per `(recipientUserId, payload.claimerUserId, payload.workUnitId)` within a 24-hour window. A duplicate emission within the window SHALL update the existing notification's timestamp (to surface it again at the top of the feed) but SHALL NOT trigger a new email.

The other claim-lifecycle kinds (`APPROVED`, `REJECTED`) SHALL NOT be deduplicated; each lifecycle event triggers its own emission.

#### Scenario: Repeated pending claim from same claimer suppresses duplicate email

- GIVEN user A has already received a `WORK_LINK_CLAIM_PENDING` from user B targeting work "work-x" 1 hour ago
- WHEN a second pending claim is created for the same `(work-x, user-b)` pair within 24 hours
- THEN no new email SHALL be sent
- AND the existing in-app notification's timestamp SHALL be refreshed
