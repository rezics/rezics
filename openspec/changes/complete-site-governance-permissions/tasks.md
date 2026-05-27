## 1. Contracts And Schema

- [ ] 1.1 Add policy action literals, policy decision DTOs, moderation case DTOs, account enforcement DTOs, and staff audit DTOs in `package/contract`.
- [ ] 1.2 Add Prisma models for moderation cases, case events, account enforcement records, policy decision records where needed, and staff audit logs in `package/server/prisma/schema.prisma`.
- [ ] 1.3 Add migration SQL and indexes for queue filtering by state, severity, realm, assignment, target, subject user, and created time.
- [ ] 1.4 Backfill existing `Feedback` reports into moderation case sources without deleting feedback rows.

## 2. Server Policy Layer

- [ ] 2.1 Create `package/server/src/governance/` with policy, moderation, enforcement, audit, mapper, API, and types modules following domain conventions.
- [ ] 2.2 Implement named policy action families for content, realm, account, case, audit, staff console, and operational repair actions.
- [ ] 2.3 Migrate high-risk routes from inline checks to policy decisions: post deletion/restoration, realm member role changes, report decisions, account enforcement, role changes, and repair actions.
- [ ] 2.4 Add policy tests for allow/deny/resource/account-state/cross-realm cases.

## 3. Moderation Workflow

- [ ] 3.1 Implement report-to-case creation and duplicate-linking service behavior.
- [ ] 3.2 Implement case list/detail/assign/triage/decision/appeal APIs.
- [ ] 3.3 Implement content hide/restore and account-enforcement decisions with event history.
- [ ] 3.4 Add notification hooks for reporter updates, subject warnings, assignment, and appeal outcomes.

## 4. Account Enforcement And Auth Boundary

- [ ] 4.1 Implement warning, silence, suspension, ban, unblock, and rate/trust restriction service methods.
- [ ] 4.2 Integrate ban/unban/session revocation with `package/auth` through existing auth-boundary patterns.
- [ ] 4.3 Update policy checks for create post, reply, realm creation, DM send, tag vote, and reaction actions to respect active enforcement.
- [ ] 4.4 Add reconciliation diagnostics for auth ban state versus main-server enforcement state.

## 5. Staff Audit

- [ ] 5.1 Add append-only audit service helpers and require reason/correlation metadata for privileged mutations.
- [ ] 5.2 Add audit list/detail APIs with redaction.
- [ ] 5.3 Migrate existing admin-sensitive operations to write audit logs.

## 6. Product-Side Staff Console

- [ ] 6.1 Add `@rezics/api` clients and TanStack Query hooks for cases, enforcement, policy-denial metadata, and audit.
- [ ] 6.2 Add `package/app/src/staff/` feature with routes for moderation queue, case detail, account safety, and audit timeline.
- [ ] 6.3 Add route guards and forbidden states for non-staff users.
- [ ] 6.4 Add focused UI tests or Storybook stories for queue empty/loading/error/denied/action states.

## 7. Verification

- [ ] 7.1 Run `bun --filter=@rezics/contract test`.
- [ ] 7.2 Run targeted `package/server` governance, post, realm, feedback, auth-boundary, and policy tests.
- [ ] 7.3 Run targeted `package/api` tests for governance clients/hooks.
- [ ] 7.4 Run targeted `package/app` tests or Storybook checks for staff console routes.
- [ ] 7.5 Run `bun run check:convention`.
- [ ] 7.6 Run `bun run format:check`.
- [ ] 7.7 Run `openspec validate complete-site-governance-permissions --strict`.
