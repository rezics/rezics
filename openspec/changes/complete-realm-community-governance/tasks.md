## 1. Contracts And Schema

- [ ] 1.1 Add realm governance action literals, member state, rules, queue item, decision, sanction, pin, lock, archive, and capability DTOs in `package/contract`.
- [ ] 1.2 Add Prisma models/fields for realm rules, rule acknowledgement, member state, realm queue item, realm mod event, pin/announcement state, lock/archive state, and escalation links.
- [ ] 1.3 Add migrations and indexes for realm queue filtering by realm, state, severity, assignment, target, and created time.
- [ ] 1.4 Backfill existing `RealmMember` rows to active state and existing feed rows to default lifecycle state.

## 2. Server Realm Governance

- [ ] 2.1 Add `package/server/src/realm-governance/` or extend the realm domain with policy, queue, rules, moderation, lifecycle, mapper, and types modules.
- [ ] 2.2 Implement realm policy actions and role hierarchy invariants.
- [ ] 2.3 Implement rules CRUD, acknowledgement, and posting/join enforcement.
- [ ] 2.4 Implement realm queue intake, decisions, local sanctions, and escalation to site moderation cases.
- [ ] 2.5 Implement pin, announcement, lock, archive, hide-from-realm, and restore-from-realm service methods.
- [ ] 2.6 Add tests for cross-realm denial, last-owner protection, member states, rule acknowledgement, local sanctions, and escalation.

## 3. Feed, Search, Notifications

- [ ] 3.1 Update realm feed APIs to support lifecycle filters, pinned ordering, hidden/moderator views, and member-only behavior.
- [ ] 3.2 Update post creation/reply APIs to enforce realm rules, lock/archive state, member state, and account enforcement.
- [ ] 3.3 Update search projections so hidden/member-only/archived realm content does not leak.
- [ ] 3.4 Add notifications for rule updates, queue assignment, moderation decisions, join approval, and escalation results.

## 4. Package App Realm Console

- [ ] 4.1 Add realm management routes under `package/app/src/routes/_mainLayout/r/$realmSlug` or the existing realm route convention.
- [ ] 4.2 Add feature modules for rules, members, moderation queue, queue detail, pins/announcements, tag curation, settings, and ownership flows.
- [ ] 4.3 Add `@rezics/api` hooks and query keys for all realm governance APIs.
- [ ] 4.4 Add UI states for loading, empty, denied, error, and destructive confirmation flows using Rezics design-system primitives.
- [ ] 4.5 Add targeted tests or Storybook stories for moderator, owner, global staff override, member, pending, muted, and banned states.

## 5. Verification

- [ ] 5.1 Run `bun --filter=@rezics/contract test`.
- [ ] 5.2 Run targeted `package/server` realm, post, search, and governance tests.
- [ ] 5.3 Run targeted `package/api` realm governance hook tests.
- [ ] 5.4 Run targeted `package/app` realm console and composer tests.
- [ ] 5.5 Run `bun run check:convention`.
- [ ] 5.6 Run `bun run format:check`.
- [ ] 5.7 Run `openspec validate complete-realm-community-governance --strict`.
