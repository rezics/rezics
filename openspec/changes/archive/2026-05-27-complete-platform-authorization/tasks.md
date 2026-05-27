## 1. Contracts And Schema

- [x] 1.1 Add policy action literals, `Decision` DTOs (allow/deny, reason, safeMessage, auditCode), capability keys, account enforcement DTOs, moderation case + realm queue DTOs, and staff audit DTOs in `package/contract`.
- [x] 1.2 Add Prisma models for moderation cases, case/realm-queue events, account enforcement records, capability grants (staff + realm), content moderation state + `RealmContentModeration` overlay, and staff audit logs in `package/server/prisma/schema.prisma`.
- [x] 1.3 Add migrations and indexes for queue filtering (state, severity, realm, assignment, target, subject, time) and for overlay lookup by `(realmUnitId, targetUnitId)`.
- [x] 1.4 Backfill existing `Feedback(REPORT)` rows into moderation case sources without deleting feedback rows.
- [x] 1.5 Ensure the realm member contract can carry a capability subset (do not foreclose with a single fixed-width `roleKey`).

## 2. Policy Engine (One Engine, Two Scopes)

- [x] 2.1 Create `package/server/src/governance/` with policy, capability, enforcement, moderation, audit, mapper, API, and types modules following domain conventions.
- [x] 2.2 Implement named policy action families for content, realm, account, case, audit, staff console, and operational repair actions, with `Permission` and capability grants as inputs.
- [x] 2.3 Implement capability-grant resolution for the staff plane and the realm plane through one mechanism (scope-aware).
- [x] 2.4 Migrate high-risk routes from inline checks to policy decisions: post delete/restore, realm member role/capability changes, report decisions, account enforcement, role changes, repair actions.
- [x] 2.5 Add policy tests by action family for allow / deny / blocked-account / missing-resource / cross-realm / capability-scope cases.

## 3. Account Enforcement And Auth Boundary

- [x] 3.1 Implement warning, silence, suspension, ban, unblock, and rate/trust restriction service methods.
- [x] 3.2 Make blocked status derive from active enforcement (single source of truth); retain only a derived projection for transport compatibility.
- [x] 3.3 Integrate ban/unban/session revocation with `package/auth` through existing auth-boundary patterns and emit boundary events.
- [x] 3.4 Apply enforcement to create post, reply, realm creation, DM send, tag vote, and reaction policy checks; add reconciliation diagnostics for auth vs. main-server state.

## 4. Content Moderation Model

- [x] 4.1 Implement global content moderation state on the content node and the sparse realm overlay keyed by `(realmUnitId, targetUnitId)`.
- [x] 4.2 Serve a realm-agnostic thread payload plus a bounded per-`(realm, node-set)` overlay set as separately cacheable sources; resolve render-side by applying global state first, then the realm overlay, with tombstones keeping the node and child replies reachable. Enforce confidential exclusions (global removal, member-only/private, age gating) server-side, never via client masking.
- [x] 4.3 Implement realm-scoped vs. global tombstone, restore/reversal, junction-drop on roots (top-level feed removal, pagination-stable), and the owner-delegation soft/fallback path.
- [x] 4.4 Exclude globally-removed content from search (backend projection on global state + junction); verify realm-A overlay never affects realm B, the global object, or search; verify reply stubs keep pagination stable.

## 5. Editorial / Moderation Boundary

- [x] 5.1 Ensure no moderation action rewrites a content body; body edits route through the editorial/authority system for all actors including `ROOT`.
- [x] 5.2 Implement ownership-based history scope: cross-owner edits always write a staff audit entry (with before/after) plus a revision when the content type maintains one; self-edits keep their type's normal behavior.

## 6. Moderation Cases, Realm Workflow, Escalation

- [x] 6.1 Implement report-to-case creation, duplicate-linking, and case list/detail/assign/triage/decision/appeal APIs.
- [x] 6.2 Implement content hide/restore and account-enforcement decisions with event history and reversal eligibility.
- [x] 6.3 Implement realm queue intake, realm decisions/local sanctions, and escalation that creates or links a site moderation case.
- [x] 6.4 Add notification hooks for reporter updates, subject warnings, assignment, appeal outcomes, and escalation results.

## 7. Staff Audit And Frontend Hints

- [x] 7.1 Add append-only audit service helpers requiring reason/correlation metadata for privileged mutations; migrate admin-sensitive operations to write audit logs.
- [x] 7.2 Add audit list/detail APIs with redaction.
- [x] 7.3 Expose staff and realm capability hints in frontend auth/membership state for UI visibility only, never for authorization.

## 8. Site Staff Console (package/app)

- [x] 8.1 Add `@rezics/api` clients and TanStack Query hooks for cases, enforcement, capability grants, policy-denial metadata, and audit.
- [x] 8.2 Add `package/app/src/staff/` feature with routes for moderation queue, case detail, account safety, and audit timeline; guard non-staff with forbidden states.
- [x] 8.3 Add focused UI tests or Storybook stories for queue empty/loading/error/denied/action states.

## 9. Verification

- [x] 9.1 Run `bun --filter=@rezics/contract test`. Package-local `package/contract` suite passed; root filter invocation ran broad workspace tests and hit unrelated baseline failures.
- [x] 9.2 Run targeted `package/server` governance, policy, post, realm, feedback, and auth-boundary tests. Targeted isolated files passed; broader post service and auth-public files retain unrelated baseline failures.
- [x] 9.3 Run targeted `package/api` tests for governance clients/hooks.
- [x] 9.4 Run targeted `package/app` tests or Storybook checks for staff console routes.
- [x] 9.5 Run `bun run check:convention`.
- [x] 9.6 Run `bun run format:check`.
- [x] 9.7 Run `openspec validate complete-platform-authorization --strict`.
