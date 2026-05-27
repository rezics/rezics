## Current State

Rezics has the pieces of governance but not the workflow. `server-permission-model` defines a canonical `Permission`, route macros authenticate requests, realm APIs check member roles, feedback stores reports, posts support soft deletion, auth admin can ban users, and admin pages expose operational data. The discovery reports show that mature references treat these as connected systems: Discourse centers policy checks in Guardian and reviewables, Flarum tests permission policies and extensions, Forem routes spam/moderator work through workers, and BookWyrm exposes reports and blocklists.

The gap is consistency. A route can be protected by an inline global-role check, a realm role check, ownership logic, or no shared decision record. Reports are not a queue. Account enforcement is split between auth and main server state. Staff actions are not uniformly auditable.

## Target Design

### Governance Model

Introduce named policy actions and decision objects:

```txt
PolicyInput
├─ actor: user id, permission, account state, trust state
├─ action: "post.delete" | "realm.manage_members" | "case.decide" | ...
├─ resource: Unit/Post/Realm/User/Case reference
├─ context: target realm, ownership, visibility, request source
└─ result: allow | deny(reason, safeMessage, auditCode)
```

The policy layer is server-only. `package/contract` exposes action literals and DTO result shapes, while `package/app` receives capability hints only to hide/show UI. The server remains authoritative.

### Moderation Cases

Reports and flags become `ModerationCase` records. A case has source kind, target kind/id, reporter, subject user, realm id when relevant, queue state, severity, assignment, decisions, appeal status, and an event log. Existing `Feedback(REPORT)` is not deleted; it is linked as source evidence.

Queue states:

```txt
new -> triaged -> assigned -> actioned -> resolved
             \-> duplicate
             \-> rejected
             \-> escalated
```

Decisions can hide content, restore content, warn user, silence user, suspend user, ban user, close as no violation, or escalate to realm/global staff depending on policy.

### Account Enforcement

Account enforcement is a main-server governance concept that coordinates with auth:

- warning: records notice and notification only;
- silence: blocks posting/replying/DM/community actions while allowing reading;
- suspension: blocks login-sensitive actions for a duration and can revoke sessions;
- ban: delegates login denial/session revocation to auth admin and records main-server enforcement;
- rate/trust restriction: applies action-level limits for new or penalized users.

Auth remains the identity/session authority. The main server owns community enforcement semantics and audit.

### Product-Side Site Staff Console

`package/app` gains staff-only routes for community operations: moderation queue, case detail, account safety view, audit timeline, and escalation inbox. This is intentionally separate from `package/admin`, which is for operator/back-office administration and diagnostics.

### Audit Trail

Every privileged action writes `StaffAuditLog` with actor, action, target, policy decision id/code, request metadata, reason, before/after summary, and correlation id. Audit logs are append-only at the application layer and queryable by root/admin staff.

## Alternatives Considered

- Keep inline role checks: rejected because object-level authorization is already too broad for `ADMIN`/`ROOT` checks.
- Move all governance to `package/admin`: rejected because community staff workflows must live near the public product context and realm operations.
- Clone Discourse/Flarum concepts directly: rejected. Rezics should reuse Unit, Realm, Post, Feedback, Subscription, Notification, and History instead of importing foreign topic/category abstractions.

## Risks

- Policy over-centralization can become a large conditional file. Mitigate with action-family modules and tests.
- Enforcement split between auth and main server can drift. Mitigate with durable enforcement events and reconciliation diagnostics.
- Staff console UI can leak sensitive data. Mitigate with safe DTOs, explicit redaction, and audit for reads of sensitive cases.

## Rollout Plan

1. Add contract action literals, policy DTOs, moderation case DTOs, enforcement DTOs, and audit DTOs.
2. Add database models and backfill existing reports.
3. Implement policy service and migrate highest-risk routes first: post delete/restore, realm management, report decision, account enforcement.
4. Add moderation case APIs and staff console routes in `package/app`.
5. Integrate auth ban/session operations through explicit boundary calls and audit events.
6. Migrate remaining privileged route checks and add convention checks for unreviewed inline staff authorization.
