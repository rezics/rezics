# Custom Theme external-live access governance

This runbook is for access managers administering the capability-gated
full-trust preview. A “core trusted member” record explains why access should
exist; only the active server-side capability grant authorizes execution.

## Authorities and separation

- `platform.access.manage` implies
  `platform.custom_theme.external_live.access.manage` and may delegate it.
- `platform.custom_theme.external_live.access.manage` may read the narrow
  Profile selector and grant, renew, or revoke only
  `platform.custom_theme.external_live.access` for another Profile.
- The narrow management capability does not grant execution, general platform
  access reads/writes, review, installation, or kill authority.
- An access manager cannot modify their own external-live eligibility. A
  different manager performs that action.
- Admission permits at most 1,000 active external-live access grants and 100
  effective access managers, including Profiles whose broad platform-access
  management capability implies the narrow manager capability. Revoke or let
  grants expire before requesting expansion; raising either limit requires a
  new capacity review.
- Every mutation requires a fresh session, an optimistic revision, and an
  expiry no more than 90 days after the mutation.

Use only:

```text
GET /api/v1/platform-access/custom-theme-external-live/profiles
GET /api/v1/platform-access/profiles/:profileId/custom-theme-external-live-access
PUT /api/v1/platform-access/profiles/:profileId/custom-theme-external-live-access
```

The mutation body is either `{ expectedRevision, state: "granted", expiresAt }`
or `{ expectedRevision, state: "revoked" }`. It cannot name a capability. Do
not grant the narrow manager access to the whole-Profile replacement endpoint.

## Admission record

Before granting, record in the governance system:

1. accountable Profile identity and operational need;
2. completion of the first-party full-trust and mutable remote supply-chain
   risk briefing;
3. expected author, reviewer, installer, or testing duties;
4. acknowledgement of safe mode, incident reporting, external data handling,
   credential handling, accessibility, licensing, and cleanup duties;
5. approving access manager and a recertification deadline no later than the
   requested grant expiry.

Never use a public label, employment state, UI role, or cohort membership as a
substitute for this record and active capability.

## Grant or renew

1. Open a fresh authenticated session.
2. Read the target's narrow access projection and verify that it is not the
   acting Profile.
3. Verify the admission record and choose the shortest useful expiry, never
   more than 90 days.
4. PUT the exact returned `revision` with `state: "granted"` and the expiry.
5. Verify the response contains a new active lifecycle-row ID and the intended
   expiry. Renewal must revoke the previous row and create a new one; it never
   edits expiry history in place.
6. Confirm the `admin_activity` audit event names grant or renewal, actor,
   target, prior row when present, new row, and expiry.

A stale revision returns a conflict. Re-read and reevaluate; do not retry with a
blind revision.

## Recertification and expiry

Review the governance record before every renewal and at least every 90 days.
Confirm continuing operational need, completed duties, incidents, review
quality, safe-mode familiarity, and an accountable incident contact. Record the
outcome even when no renewal is granted. Expiry is fail-closed on the next
authorization check and must not be bypassed by a cached cross-viewer
presentation.

## Revoke

Revoke promptly when the member leaves the cohort, loses the operational need,
misses recertification, mishandles data or credentials, fails review duties, or
creates an incident risk. Read the current revision, PUT `state: "revoked"`,
verify no active grant remains, confirm the audit event, and follow the incident
runbook if a loaded revision may still be active in a browser.

Revocation removes eligibility. It does not itself kill a revision, uninstall
it from a host, or disable the platform globally.
