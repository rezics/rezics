## Why

Rezics has the pieces of authorization — global roles, realm member roles, reports,
soft deletion, account ban via auth — but no single authoritative mechanism. Routes
are protected by scattered inline role checks, realm and site policy would otherwise
be built twice as two separate engines, account enforcement is split between auth and
the main server with no shared decision record, and privileged actions are not
uniformly auditable. Mature community products (Discourse Guardian/reviewables,
Flarum, Reddit subreddit moderation, GitHub stafftools) treat authorization as **one
policy mechanism evaluated at every privileged action**, scoped from global staff down
to per-community moderators.

This change establishes that single authorization foundation. Community **product**
surfaces (realm feed, rules UX, pinboard, tag tree, the realm management console) are
intentionally out of scope; they consume this layer and are delivered by
`complete-realm-community-governance`.

## What Changes

- Introduce a server-authoritative **policy engine**: named action literals evaluated
  against `PolicyInput{ actor, action, resource, context }` returning
  `Decision{ allow|deny, reason, safeMessage, auditCode }`. One engine serves both
  global (site) and realm scopes; `Permission` becomes one input, not the whole model.
- Add a unified **capability-grant layer** for both planes: flat role enums stay as the
  fast-path identity tier, while finer privilege is expressed as scoped, audited,
  expirable capability grants (staff capabilities and realm moderator capability
  subsets share one shape).
- Add **account-safety enforcement** (warning, silence, suspension, ban, rate/trust
  restriction) as a first-class policy input, and make **blocked status derive from
  enforcement** rather than a standalone `BLOCKED` role literal.
- Add the **moderation case + queue state machine** (site) and **realm moderation
  workflow** (escalation, decisions, sanctions, case linkage) as the shared governance
  backbone. Console UIs that drive them live in the consuming product changes.
- Add a **content-moderation model** that separates inherited realm placement from
  per-node-per-context moderation: a global content moderation state plus a sparse
  realm overlay keyed by `(realmUnitId, targetUnitId)`, enabling realm-scoped tombstones
  of any node including replies, with thread integrity preserved.
- Establish the **editorial / moderation boundary**: moderation only changes state
  (hide/remove/lock/restore/enforce) and never rewrites a body; body edits flow through
  the editorial/authority system for every actor including `ROOT`. History scope follows
  ownership — self-edits keep their type's normal behavior, cross-owner edits always
  write a staff audit entry (plus a revision when the type maintains one).
- Add **staff audit logging** for privileged global actions, append-only at the
  application layer with reason, decision code, before/after summary, and correlation id.
- Add the **site staff console** product-side surface (`package/app`) for queue, case
  detail, account safety, and audit timeline — distinct from `package/admin`.
- **BREAKING**: server authorization SHALL migrate from scattered inline role checks to
  named policy actions and decision objects in a clear development-stage cutover.

## Capabilities

### New Capabilities

- `site-governance-policy`: Global and resource-aware policy evaluation for server actions.
- `realm-governance-policy`: Realm-scoped action policy, role hierarchy, and delegation.
- `capability-grants`: Scoped, audited capability grants spanning the staff and realm planes.
- `account-safety-enforcement`: Warning, silence, suspension, ban, trust/rate restriction, unblock.
- `moderation-case-workflow`: Site report intake, review queue, assignments, decisions, appeals.
- `realm-moderation-workflow`: Realm report intake, mod queue, sanctions, escalation, case linkage.
- `content-moderation-overlay`: Placement-vs-moderation separation, global state, realm overlay, tombstones.
- `editorial-moderation-boundary`: Moderation-is-state-change rule and ownership-based history scope.
- `staff-audit-log`: Immutable privileged-action audit records and staff-visible audit queries.
- `site-staff-console`: Product-side staff tools in `package/app` (not `package/admin`).

### Modified Capabilities

- `server-permission-model`: Expand from a role object into policy-aware governance semantics; blocked status derives from enforcement.
- `server-permission-guards`: Routes use policy decisions for privileged actions with consistent denial reasons.
- `frontend-server-permission`: Frontend exposes staff/realm capability hints without trusting the client for authorization.
- `auth-admin`: Auth account administration integrates with main-server enforcement and audit events.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/auth`, `package/api`, `package/app`, `package/notification`, `package/search`, `package/job-runner`, and seed/test fixtures.
- Database impact: add moderation case/event, realm queue item/event, account enforcement, capability grant, content moderation state + realm moderation overlay, and staff audit log tables/fields in the main server schema; auth retains identity/session state but emits boundary events.
- API impact: add typed action literals, policy decision DTOs, capability, enforcement, moderation, and audit endpoints through `@rezics/contract` and `@rezics/api`.
- Migration/backward compatibility: existing `Feedback(REPORT)` rows SHALL be backfilled as case sources; existing global and realm roles remain valid; scattered inline checks migrate in a clear development-stage cutover.
- Dependents: `complete-realm-community-governance` (realm product + management console) and `complete-admin-operations-panel` consume this layer rather than redefining policy.
