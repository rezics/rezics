## Why

`complete-public-app-product-experience` surfaces the public app over existing
typed APIs. Three of its Settings requirements — per-kind notification
preferences, blocked-users management, and data export / account deletion —
turned out to need **net-new backend** that the storage layer does not support
today:

- `userSettings` (`User.settings Json?`) has no notification-preference field,
  and `dispatch.service` has no per-kind delivery gate.
- There is no user-to-user block model; only a per-conversation DM block
  (`/dm/blocks`) and admin-level enforcement exist. Platform-wide content
  hiding has no primitive.
- There are no user-facing data-export or account-deletion endpoints
  (`account-operation` is admin impersonation / session control only).

These are safety- and privacy-critical, irreversible, and cross-cutting
(notification pipeline, content visibility, GDPR-style export/erasure). They
warrant their own proposal rather than being guessed inline during an
app-surfacing change. This change carves them out and specifies the backends
plus the Settings UI that consumes them.

## What Changes

- Add per-kind notification preferences: a `notifications` field on
  `userSettings` with toggles for reply, follow, DM, moderation outcome, realm
  event, and system notice; enforce them in the notification dispatch pipeline
  (feed + push) through a typed mutation.
- Add user-to-user blocking: a block model + service that lists/adds/removes
  blocked users, hides blocked users' content, and prevents DM, scoped by the
  foundation policy engine. Reuse the existing DM block primitive where it fits.
- Add data export and account deletion: typed endpoints with explicit
  confirmation. Deletion describes what is removed, anonymized, or retained for
  safety/audit before the user confirms.
- Add the Settings sub-pages that consume the above: notification preferences
  (per-kind toggles), blocked-users management, and a data/account section with
  export and deletion entry points — all through `@rezics/api`, no app-local DTOs.

## Capabilities

### Modified Capabilities

- `settings-layout`: Settings gains per-kind notification preferences,
  blocked-users management, and data export / account deletion, each backed by
  typed API endpoints and persisted through typed mutations.

## Impact

- Affected packages: `package/contract`, `package/server` (settings, dispatch /
  notify-boundary, a new block domain, account export/deletion), `package/api`,
  `package/app` (Settings sub-pages), and Prisma schema (block model +
  `userSettings.notifications`).
- Migrations: new block table; `User.settings` JSON gains a `notifications`
  shape (no column change). Deletion semantics require an explicit
  anonymize/retain policy reviewed before implementation.
- Carved out of `complete-public-app-product-experience` tasks 8.3 and 8.4;
  task 8.2 (activity timeline) stays in that change and is complete.
