## Current State

Rezics has authorization pieces but not one mechanism. `server-permission-model` defines a
canonical `Permission { role }`; route macros authenticate requests; realm APIs check
`RealmMember.roleKey`; resource helpers (`hasPermissionToUpdateX(permission, actorUserId, resource)`)
hand-roll ownership + admin override per type; feedback stores reports; posts support soft
deletion; auth admin can ban. The gap is consistency: a route can be gated by an inline global
role check, a realm role check, ad hoc ownership logic, or nothing shared, and privileged actions
are not uniformly audited.

Discovery confirms mature references converge on one policy mechanism: Discourse centers checks in
Guardian and routes review through reviewables; Reddit gives subreddit moderators a narrow,
granular permission set escalating to site admins; GitHub separates a flat staff/stafftools plane
from a scoped org/repo permission plane. Rezics already chose the **subreddit-shaped** direction
(realm ≈ subreddit, not GitHub org): a flat moderator list per community, no nested teams, no
per-resource role grants.

## Target Design

### Two planes, one engine

Authorization has two planes that must not be built as two engines:

```
STAFF PLANE (operator)      ROOT / ADMIN — flat identity tier (correct to be flat)
PRODUCT PLANE (scoped)      realm: owner > admin > moderator > member
```

Both resolve through one policy entry point:

```
PolicyInput
├─ actor:    user id, role, capabilities, account-enforcement state, trust state
├─ action:   "post.delete" | "realm.queue.decide" | "case.decide" | "account.ban" | ...
├─ resource: Unit/Post/Realm/User/Case reference
├─ context:  target realm, ownership, visibility/status, request source, scope
└─ Decision: allow | deny(reason, safeMessage, auditCode)
```

The policy layer is server-only and authoritative. `package/contract` exposes action literals and
`Decision` DTO shapes; clients receive **capability hints** only, for showing/hiding UI. `reason`
(internal/audit) is separated from `safeMessage` (user-facing) so denials never leak policy internals.

### Roles coarse, capabilities granular (both planes)

The flat role enum stays as the fast-path rejection tier; finer privilege is a capability grant the
engine reads as another input. The same grant shape serves both planes, differing only by scope:

```
Permission.role = ADMIN                 ← coarse, fast-path reject
        +
StaffGrant{ userId, capability, scope?, grantedBy, expiresAt }   ← staff plane
RealmCapability{ realmMember, capability }                       ← realm plane (subset of mod powers)
```

`ROOT` implies all staff capabilities. This makes "an admin who can decide cases but not ban
accounts" and "a moderator with only the queue, not tags" both expressible without exploding the
role enum. `RealmMember.roleKey VarChar(32)` alone cannot carry a capability subset, so the realm
member contract must not foreclose per-member capabilities.

### Account enforcement as a policy input; blocked is derived

Enforcement (warning, silence, suspension, ban, rate/trust restriction) is a main-server concept
coordinated with auth. It is an orthogonal gate the policy reads, not a role:

- warning — notice + notification only;
- silence — blocks posting/replying/DM/community actions, allows reading;
- suspension — blocks login-sensitive actions for a duration, may revoke sessions;
- ban — delegates login denial/session revocation to auth, records main-server enforcement;
- rate/trust — action-level limits for new or penalized users.

`BLOCKED` ceases to be an independent authority: blocked status **derives from active enforcement**
so there is a single source of truth. Auth remains the identity/session authority; the main server
owns community enforcement semantics and audit; durable boundary events + reconciliation diagnostics
guard against drift.

### Content moderation: placement vs. overlay

Rezics content is many-to-many with realms and threaded, so "remove a sub-unit from a realm" is the
wrong primitive. Placement is inherited; moderation state is per-node-per-context:

```
① PLACEMENT (membership) — inherited, ROOT-only, M:N        UnitRealm{ realmUnitId, rootUnitId }
② CONTENT NODE — global, one row per post AND reply         Post/Unit{ id, parentId?, globalModerationState }
③ REALM MODERATION OVERLAY — sparse, per-(realm, node)      RealmContentModeration{
                                                              realmUnitId, targetUnitId,   ← may be a reply
                                                              state: tombstoned|hidden|locked, decidedBy, caseId? }
```

Replies never join realms; they inherit the thread root's placement. A realm moderator tombstones a
node by writing an overlay row; render resolution is: global state first, then the realm overlay for
the viewing context. So a reply can be `[removed]` in realm A while intact in realm B and on the
global object, and child replies stay reachable under the stub. Two clean verbs result:

- **junction-drop** (root only) — the thread no longer belongs to a realm;
- **node tombstone** (any node, realm-scoped or global) — Reddit's `[removed]` stub.

Owner-delegation (notify the owner to remove their own sub-content) is the **soft path** for
non-violations and a **fallback** when a realm moderator deliberately lacks node takedown power;
it is not the primary mechanism, because it is slow and fails when the owner is the violator.

**Where the overlay is applied — render time, by caching, not by DB load.** A batched indexed
lookup `WHERE realmUnitId=A AND targetUnitId IN (thread node ids)` is cheap, so DB cost is not the
deciding factor. The deciding factor is **cache coherence**: applying the overlay server-side would
make the thread payload realm-specific and bust the whole thread cache on every mod action, whereas
composing a **realm-agnostic thread payload** (long-lived cache, full bodies) with a small
**per-realm overlay set** (invalidated only when a mod acts) keeps the large payload stable. The
frontend composes two cache entries:

```
QueryKey ① thread:{rootId}              ← realm-agnostic, full bodies, long cache
QueryKey ② realmOverlay:{realmId,rootId} ← per-realm, small, invalidates on mod action
   → frontend selector renders [removed] stubs; children preserved; reply pagination stable
```

This client-side masking is sound **only because the realm overlay is non-confidential** — the
content is public in other realms and on the global object. Confidential exclusions are a different
model and stay server-side: global removal (null/exclude in the response), member-only/private realm
visibility, and age gating. Top-level feed removal is **junction-drop** (absent from the realm's feed
query), so it needs no overlay and keeps feed pagination stable; the overlay is primarily a
thread-internal, reply-level concern. Search (a backend projection) filters on global state +
junction; realm reply-overlays generally do not reach search.

### Editorial / moderation boundary

Moderation changes **state** (hide/remove/lock/archive/restore/enforce); it never **rewrites** a
body. Body edits flow through the editorial/authority system (`content-authority`,
`editorial-patch-protocol`, wiki, `history`) for every actor including `ROOT` — there is no silent
moderation edit. History scope follows ownership, not a blanket rule:

```
                            │ content REVISION?               │ staff AUDIT?
────────────────────────────┼─────────────────────────────────┼──────────────────
owner edits OWN content      │ per content-TYPE policy          │ no
admin edits OTHERS' content  │ if type has revisions → yes      │ ALWAYS (+ before/after)
                             │ else → audit snapshot carries it │
moderation (hide/remove/lock)│ no — it is a state change        │ ALWAYS
```

So history is not forced onto all content and self-edits are unburdened; only cross-owner edits are
mandatorily recorded — via the audit log (which carries before/after) plus a revision if the type
already maintains one. Cross-owner editing is rare by design, so the heavily logged path is the
infrequent one.

### Moderation cases, queues, escalation

Reports/flags become `ModerationCase` records (site) and realm queue items (realm); existing
`Feedback(REPORT)` is linked as source evidence, not deleted. Site queue states:

```
new -> triaged -> assigned -> actioned -> resolved
             \-> duplicate  \-> rejected  \-> escalated
```

Realm decisions (hide-from-realm, remove-from-feed, lock, archive, warn, mute-in-realm,
remove/ban-from-realm, reject, duplicate) stay realm-scoped; a realm moderator MAY escalate to a
site case. Realm bans do not change global account state unless escalated. Global staff MAY act in
any realm by site policy, but such overrides write both a staff audit entry and a realm event.

### Site staff console + audit

`package/app` gains staff-only routes (queue, case detail, account safety, audit timeline) — near
the public product context, distinct from `package/admin` operator tooling. Every privileged action
writes an append-only `StaffAuditLog` with actor, action, target, decision id/code, request
metadata, reason, before/after summary, and correlation id.

## Alternatives Considered

- **Keep site and realm governance as two changes** (the previous split): rejected — it forces the
  same policy engine to be specified and built twice and invites the enforcement/policy drift the
  risks call out. This change carves on **layer (mechanism vs. product)** instead, holding all
  authorization here and leaving realm community product to `complete-realm-community-governance`.
- **One mega-change** bundling realm community product (feed, pinboard, tags) with the auth engine:
  rejected — product UI does not belong in the authorization foundation.
- **Keep `BLOCKED` as an authoritative role**: rejected — duplicates the enforcement layer with a
  second, divergent source of truth.
- **Force revision history on all content / route all edits through it**: rejected — too heavy and
  not a permission concern; only cross-owner edits need mandatory recording.
- **A ReBAC tuple store (Zanzibar/OpenFGA-style)**: rejected for now — realm is subreddit-shaped
  (flat mod list, no teams, no per-resource grants), so computed policy over normalized tables is
  sufficient; revisit only if reverse "what can X access?" queries become a real requirement.
- **Clone Discourse/Flarum abstractions directly**: rejected — reuse Unit, Realm, Post, Feedback,
  Subscription, Notification, History rather than importing foreign topic/category models.

## Risks

- Policy over-centralization can become a large conditional file. Mitigate with action-family modules and tests.
- Enforcement split between auth and main server can drift. Mitigate with durable enforcement events and reconciliation diagnostics.
- Realm-overlay rendering adds a per-context lookup. The DB cost is negligible (one indexed batched `(realm, node-set)` lookup); the real concern is cache coherence, which is why the overlay is applied at render time over a realm-agnostic payload rather than server-contextualized. Confidential exclusions are enforced server-side instead.
- Staff/realm console reads can leak sensitive data. Mitigate with safe DTOs, redaction, and audit for sensitive reads.

## Open Questions (carried from exploration)

- Moderator invite/acceptance handshake vs. direct role assignment.
- Peer-moderator authority (can a moderator act on a same-tier moderator; seniority ordering?).
- Default/auto-join realm governance: who moderates "the site as a community"?
- M:N hide precedence statement: realm-A hide never affects realm B; only a site case touches the global object.

## Rollout Plan

1. Add contract action literals, `Decision`/capability/enforcement/case/audit DTOs.
2. Add database models (cases, realm queue, enforcement, capability grants, content moderation state + realm overlay, audit) and backfill existing reports.
3. Implement the policy engine and migrate highest-risk routes first: post delete/restore, realm management, report decision, account enforcement, role/capability changes.
4. Implement moderation case + realm workflow APIs and escalation linkage.
5. Integrate auth ban/session operations through explicit boundary calls and audit events.
6. Add the site staff console and migrate remaining privileged route checks; add convention checks for unreviewed inline staff authorization.

## Contract Lock-in (resolved for implementation)

This change is the foundation that gates `complete-realm-community-governance`,
`complete-admin-operations-panel`, and `complete-public-app-product-experience`.
The following contracts MUST be pinned before the policy engine is written, so
downstream changes do not inherit ambiguity. See `implement_goal.md` (Phase 1).

- **Capability registry** — `package/contract/src/permission/capability.ts`: a
  closed, namespaced key list plus a `Capability` type. Initial keys:
  `account.warn|silence|suspend|ban|rate_limit`,
  `moderation.case.triage|assign|decide|escalate|reverse`,
  `queue.site.decide`, `queue.realm.decide`,
  `content.takedown|lock|archive|restore`, `tag.curate`, `audit.read`.
- **Decision codes** — `package/contract/src/permission/decision.ts`: a
  `DecisionCode` enum shared by policy output and audit, e.g. `ALLOWED`,
  `MISSING_CAPABILITY`, `ENFORCEMENT_ACTIVE`, `BLOCKED_ACCOUNT`,
  `CROSS_REALM_DENIED`, `LAST_OWNER_PROTECTED`, `RATE_LIMITED`, `NOT_MEMBER`.
- **Realm role hierarchy** — a typed `RealmMemberRole`
  (`owner > admin > moderator > member`) plus an ordering helper and a
  last-owner-protection invariant. `RealmMember.roleKey` remains the storage
  column; this gives it a contract.
- **Policy I/O** — `PolicyInput` (actor id, resolved capabilities, active
  enforcement, realm membership/role, target ref) → `PolicyDecision`
  (`allowed`, `code: DecisionCode`, audit metadata). The engine exposes a single
  `decide(input)` entry.
- **Schema models (additive Prisma)** — `StaffGrant`, `RealmCapabilityGrant`,
  `AccountEnforcement` (+ a derived account-status projection), `ModerationCase`,
  `ModerationCaseEvent`, `RealmModerationQueueItem`, `RealmModerationEvent`,
  `ContentModerationState`, `RealmContentModeration`, `StaffAuditLog`.
- **Case-source link** — model `ModerationCase ↔ Feedback` as an explicit
  relation (a `ModerationCase.sourceFeedbackId` FK for v1; a `CaseSource`
  junction only if multi-source is needed). Backfill existing `Feedback(REPORT)`.
- **`BLOCKED` migration** — `Permission.role = BLOCKED` is downgraded to a
  derived projection of `AccountEnforcement`. Ship a migration converting
  existing BLOCKED users into the equivalent enforcement record.
- **Auth↔server boundary protocol** — define the event shape, delivery mechanism
  (durable queue/outbox preferred over webhook/poll), and reconciliation query
  for the split where `package/auth` owns identity/ban and `package/server` owns
  community enforcement. Implemented through `package/server/src/auth-boundary/`.
- **Frontend permission hints DTO** — non-authoritative capability hints for UI
  affordances; every real decision stays server-side.
- **Domain placement** — the engine lives in `package/server/src/governance/`
  (a domain, not a new workspace package). Policy actions are split into
  `actions/account.ts`, `actions/content.ts`, `actions/realm.ts` to avoid a
  monolithic policy file; a convention check flags policy files over ~500 lines.
