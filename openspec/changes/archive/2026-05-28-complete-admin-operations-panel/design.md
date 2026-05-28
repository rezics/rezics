## Current State

The admin package has useful pages: auth users/sessions/status/JWT services, Meili observability, system status, units, entities, realms, shelves, source sites, users, settings, tokens, and authority. It also has admin route guards and navigation. The missing piece is operator coherence: pages do not yet form a complete console with shared dashboard, bulk operation patterns, repair workflows, audit visibility, and cross-service observability.

Mature references such as Ghost and Discourse invest heavily in admin UX because operations work spans content, accounts, queues, search, health, email/session/auth, reports, and repair tools. Rezics should follow that maturity while staying aligned with its typed monorepo architecture.

## Target Design

### Admin Boundary

`package/admin` is for operators:

```txt
package/app
├─ public user experience
├─ product-side staff moderation
└─ realm owner/moderator console

package/admin
├─ root/admin operations
├─ data integrity and repair
├─ auth/account/platform security
├─ observability and queues
└─ governance oversight/override
```

Realm moderators do not need admin access. Product staff can work in `package/app`; root/admin operators use `package/admin` when they need broader visibility or repair tools.

### Admin Shell

The shell provides:

- dashboard with system status, queue health, search drift, moderation/enforcement counts, recent audit, and repair warnings;
- navigation grouped by Operations, Content, Accounts, Governance, Search/Sync, System;
- consistent tables with saved filters, search, pagination, selection, bulk actions, export where safe;
- destructive-action confirmation requiring reason and showing impact preview;
- compact density and tokenized design per Rezics admin rules.

### Content Operations

Operators can inspect and repair:

- Units across all types;
- work/release grouping and `UnitWork` drift;
- entities, tags, realms, shelves, source-site attribution;
- status/visibility/publication state;
- slugs, aliases, external refs, translations;
- history and search projection status.

Admin edits are not a replacement for normal contribution/editor workflows. They are repair and authority operations with audit.

### Account Operations

Account operations unify auth-server and main-server state:

- auth users, sessions, roles, bans, impersonation;
- main user Unit/profile linkage;
- token/JWT service controls;
- account enforcement from governance;
- reconciliation warnings between auth and main server.

### Observability And Repair

Admin exposes safe diagnostics and actions:

- system status;
- Meili indexes/settings/doc counts/drift;
- job-runner queues/retries/failures;
- Sequin/CDC support and publication drift;
- history outbox and sync lag;
- repair job dry-run/start/status/retry/cancel where safe.

### Governance Oversight

Operators can view moderation/enforcement/audit state, perform global override actions, and inspect escalations. Day-to-day realm queue work remains in realm/product contexts unless escalated.

## Alternatives Considered

- Put all moderation inside admin: rejected because realm moderators and product staff should not need operator panel access.
- Keep separate pages without shell-level patterns: rejected because operations require consistent filtering, audit, bulk actions, and repair safety.
- Build admin as a generic CRUD generator: rejected because Rezics operations are domain-specific and tied to Unit/Search/History/Auth boundaries.

## Risks

- Admin can become too powerful without guardrails. Mitigate with root/admin role gates, reasons, impact previews, audit logs, and policy checks.
- Cross-service diagnostics may leak secrets. Mitigate with server-side aggregation and redaction.
- Bulk operations can corrupt data. Mitigate with dry-run, queued repair, idempotency, and status pages.

## Rollout Plan

1. Define shell/navigation/dashboard and admin access model.
2. Normalize admin table/filter/action patterns and route grouping.
3. Complete account operations and reconciliation.
4. Complete content operations and data repair workflows.
5. Complete observability/job/search/CDC/history panels.
6. Add governance oversight and audit integration.
7. Add focused admin stories/tests and strict validation.

## Contract Lock-in (resolved for implementation)

Depends on `complete-platform-authorization` for governance/audit models. Build
the governance-oversight section after that change is archived. Admin stays
operations/repair — never an app-side editing duplicate. See `implement_goal.md`
(Phase 5). Contracts to pin:

- **Reuse foundation audit** — consume `StaffAuditLog` from
  `complete-platform-authorization`; do **not** build a parallel admin audit
  model. Declare this dependency in `proposal.md`.
- **`AdminRepairJob`** — new contract `package/contract/src/admin-repair-job.ts`:
  status (`pending` | `running` | `succeeded` | `failed` | `cancelled`), scope
  (`search` | `history-outbox` | `work-domain` | `slug` | `attribution` |
  `counters`), a per-scope dry-run response shape, progress, and an audit link.
  Long-running jobs route through `job-runner`. Work-domain repair continues to
  use the existing `AdminWorkMergeOperation`.
- **`AuthMainServerReconciliationWarning`** — DTO describing drift (e.g. an auth
  user with no main-server profile link) plus a suggested repair action.
- **Impersonation control DTO** — scope + expiry + mandatory audit link.
- **`FilterState` / `BulkAction`** — shared table abstractions to extend
  `PaginatedTable` with saved filters, selection, and bulk actions; pin the shape
  before refactoring the component.
