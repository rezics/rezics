## Why

Rezics already has global roles, realm roles, reports, soft deletion, subscriptions, notifications, and admin/auth surfaces, but these are not yet one mature governance system. Mature community products such as Discourse, Flarum, Forem, and BookWyrm show that public UGC needs object-level authorization, abuse queues, account enforcement, and audit trails before traffic grows.

## What Changes

- Introduce a site governance policy layer that evaluates actor, action, resource, ownership, publication state, visibility, realm membership, account state, and global staff role consistently across server routes.
- Add a moderation case workflow that turns feedback reports, realm reports, content flags, and internal staff actions into auditable cases with queue states, assignments, decisions, and appeals.
- Add account safety enforcement for warning, silencing, suspending, banning, session revocation, and rate-limit/trust restrictions.
- Add staff audit logging for privileged global actions, including permission changes, moderation decisions, account enforcement, impersonation, and destructive repair operations.
- Distinguish three governance surfaces:
  - product-side site staff capabilities in `package/app` for global staff who participate in community operations;
  - realm moderator capabilities owned by realm pages and covered by `complete-realm-community-governance`;
  - operational back-office panels in `package/admin`, covered separately by `complete-admin-operations-panel`.
- Keep existing `Permission`, `RealmMember`, `Feedback`, `Post`, `Unit`, `Subscription`, `Notification`, `History`, and search infrastructure as the base rather than introducing `introduce-api-unit-store`.
- **BREAKING**: server authorization helpers SHALL migrate from scattered inline role checks to named policy actions and decision objects.

## Capabilities

### New Capabilities

- `site-governance-policy`: Global and resource-aware policy evaluation for server actions.
- `moderation-case-workflow`: Report intake, review queues, assignments, decisions, appeals, and case history.
- `account-safety-enforcement`: Account warning, silence, suspension, ban, session revocation, trust/rate restriction, and unblock flows.
- `staff-audit-log`: Immutable privileged-action audit records and staff-visible audit queries.
- `site-staff-console`: Product-side staff tools in `package/app` that are not the operational `package/admin` panel.

### Modified Capabilities

- `server-permission-model`: Expand from a role object into policy-aware governance semantics while preserving the canonical `Permission` shape.
- `server-permission-guards`: Routes use policy decisions for privileged actions and return consistent denial reasons.
- `frontend-server-permission`: Frontend permission state exposes global staff capability hints without trusting the client for authorization.
- `auth-admin`: Auth account administration integrates with main-server enforcement and audit events.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/auth`, `package/api`, `package/app`, `package/notification`, `package/search`, `package/job-runner`, and seed/test fixtures.
- Database impact: add moderation case, moderation event, account enforcement, policy exemption/rate restriction, and staff audit log tables in the main server schema; auth-service user/session operations remain in the auth schema but emit main-server boundary events.
- API impact: add typed governance, moderation, account enforcement, audit, and site staff console endpoints through `@rezics/contract` and `@rezics/api`.
- Migration/backward compatibility: existing `Feedback(REPORT)` rows SHALL be backfilled into moderation cases; existing global roles remain valid; scattered admin checks are migrated in a clear development-stage cutover.
