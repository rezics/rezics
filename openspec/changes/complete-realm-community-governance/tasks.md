## 1. Contracts And Schema

- [ ] 1.1 Add realm governance action literals, member state, rules, queue item, decision, sanction, pin, lock, archive, and capability DTOs in `package/contract`.
- [ ] 1.2 Add Prisma models/fields for rule acknowledgement/version policy, member state, realm queue item, realm mod event, lock/archive/hide state, and escalation links. Reuse `Realm.extra.rule`, `Realm.extra.pinboard`, and `Realm.extra.announcement` for rule/pin references unless a spec explicitly requires a normalized replacement.
- [ ] 1.3 Add migrations and indexes for realm queue filtering by realm, state, severity, assignment, target, and created time.
- [ ] 1.4 Backfill existing `RealmMember` rows to active state and existing feed rows to default lifecycle state.
- [ ] 1.5 Extend contract shapes for realm tag tab display preference (`flat`/`grouped`/`tree`, viewer switching), typed `Realm.extra.tagView`, and multilingual tagTree/group label strategy.

## 2. Server Realm Governance

- [ ] 2.1 Add `package/server/src/realm-governance/` or extend the realm domain with policy, queue, rules, moderation, lifecycle, mapper, and types modules.
- [ ] 2.2 Implement realm policy actions and role hierarchy invariants.
- [ ] 2.3 Implement rules CRUD around `Realm.extra.rule`, POST rule Unit/UnitTranslation/source rule Posts, localized rule resolution, acknowledgement identity/version metadata, and posting/join enforcement.
- [ ] 2.4 Implement realm queue intake, decisions, local sanctions, and escalation to site moderation cases.
- [ ] 2.5 Implement pin and announcement policy/audit wrappers over the existing realm-extra list primitives; implement lock, archive, hide-from-realm, and restore-from-realm service methods.
- [ ] 2.6 Add tests for cross-realm denial, last-owner protection, member states, rule acknowledgement, local sanctions, and escalation.

## 3. Feed, Search, Notifications

- [ ] 3.1 Update realm feed APIs to support lifecycle filters, hidden/moderator views, member-only behavior, and composition with the separate `Realm.extra.pinboard` source.
- [ ] 3.2 Update post creation/reply APIs to enforce realm rules, lock/archive state, member state, and account enforcement.
- [ ] 3.3 Update search projections so hidden/member-only/archived realm content does not leak.
- [ ] 3.4 Add notifications for rule updates, queue assignment, moderation decisions, join approval, and escalation results.

## 4. Package App Realm Console

- [ ] 4.1 Add realm management routes under `package/app/src/routes/_mainLayout/r/$realmSlug` or the existing realm route convention.
- [ ] 4.2 Add feature modules for rules, members, moderation queue, queue detail, pins/announcements, tag curation, settings, and ownership flows.
- [ ] 4.3 Add `@rezics/api` hooks and query keys for all realm governance APIs.
- [ ] 4.4 Add UI states for loading, empty, denied, error, and destructive confirmation flows using Rezics design-system primitives.
- [ ] 4.5 Add targeted tests or Storybook stories for moderator, owner, global staff override, member, pending, muted, and banned states.
- [ ] 4.6 Add realm i18n editing for metadata, rules, about content, pinboard-created entries, and tagTree/group labels using the shared UnitTranslation editor/resolution patterns.
- [ ] 4.7 Add tag tab display preference controls for `flat`, `grouped`, and `tree`, including realm creation defaults.

## 5. Package App Realm Product UI

- [ ] 5.1 Keep the realm Feed tab as the default realm detail tab with pinboard, required rule prompts, feed controls, quick filters, and the discussion stream.
- [ ] 5.2 Replace the public vertical pinned list with a Pinboard carousel/rail using existing Rezics carousel primitives and pinboard data hooks.
- [ ] 5.3 Add rule summary card/dialog UI for feed prompts, about tab, sidebar, join gate, and post gate flows with UnitTranslation fallback.
- [ ] 5.4 Build the Tags tab with `flat`, `grouped`, and `tree` render modes over the semantic tagTree structure.
- [ ] 5.5 Add the About tab for full rules/about/stats/join-policy/moderator context, and an optional desktop realm summary sidebar while preserving mobile inline layouts.
- [ ] 5.6 Add the moderator-only Moderation tab as the product entry for queue, reports, sanctions, and audit views.

## 6. Verification

- [ ] 6.1 Run `bun --filter=@rezics/contract test`.
- [ ] 6.2 Run targeted `package/server` realm, post, search, and governance tests.
- [ ] 6.3 Run targeted `package/api` realm governance hook tests.
- [ ] 6.4 Run targeted `package/app` realm console, realm feed, about tab, moderation tab, tag tab, pinboard, and composer tests.
- [ ] 6.5 Run `bun run check:convention`.
- [ ] 6.6 Run `bun run format:check`.
- [ ] 6.7 Run `openspec validate complete-realm-community-governance --strict`.
