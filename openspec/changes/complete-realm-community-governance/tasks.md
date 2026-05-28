> Depends on `complete-platform-authorization`. Realm policy actions, role/capability
> model, moderation queue/decision/escalation engine, content lock/archive/hide state,
> and audit are defined there; tasks below consume those APIs rather than redefining them.

## 1. Contracts And Schema

- [x] 1.1 Add realm community product DTOs in `package/contract`: rules content references, acknowledgement identity/version metadata, and tag tab display preference. (Realm action literals, member state, queue/decision/sanction, and lock/archive DTOs come from the foundation.)
- [x] 1.2 Add Prisma fields for rule acknowledgement/version policy, rule content references, member-onboarding flags, and typed `Realm.extra.tagView`. Reuse `Realm.extra.rule`, `Realm.extra.pinboard`, and `Realm.extra.announcement` unless a spec requires a normalized replacement.
- [x] 1.3 Backfill existing `RealmMember` rows to active state and existing feed rows to default lifecycle state (coordinated with the foundation's member-state migration).
- [x] 1.4 Extend contract shapes for tag tab display preference (`flat`/`grouped`/`tree`, viewer switching) and the multilingual tagTree/group label strategy.

## 2. Server Realm Community Behavior

- [ ] 2.1 Add or extend the realm domain with rules, lifecycle, pin/announcement, and membership-metadata modules that call the foundation's realm policy for authorization.
- [x] 2.2 Implement rules CRUD around `Realm.extra.rule`, POST rule Unit/UnitTranslation/source rule Posts, localized rule resolution, acknowledgement identity/version metadata, and posting/join enforcement.
- [x] 2.3 Implement pin and announcement product wrappers over the existing realm-extra list primitives, invoking foundation policy/audit for privileged changes.
- [x] 2.4 Expose current-user membership + capability metadata for realm UI via `GET /realms/:unitId/members/me`, sourcing capability hints from the foundation.
- [x] 2.5 Add tests for rule acknowledgement, member-only/preview behavior, pin/announcement product flows, and membership metadata.

## 3. Feed, Search, Notifications

- [x] 3.1 Update realm feed APIs to support lifecycle filters, hidden/moderator views, member-only behavior, and composition with the `Realm.extra.pinboard` source, rendering moderation state from the foundation's content-moderation model.
- [x] 3.2 Update post creation/reply APIs to enforce realm rules and consume the foundation's lock/archive, member-state, and account-enforcement decisions.
- [x] 3.3 Update search projections so hidden/member-only/archived realm content does not leak (aligned with the foundation's overlay/tombstone resolution).
- [x] 3.4 Add product notifications for rule updates and join approval; moderation-decision/assignment/escalation notifications are emitted by the foundation.

## 4. Package App Realm Console

- [ ] 4.1 Add realm management routes under `package/app/src/routes/_mainLayout/r/$realmSlug` or the existing realm route convention.
- [ ] 4.2 Add feature modules for rules, members, moderation queue, queue detail, pins/announcements, tag curation, settings, and ownership flows, driving the foundation's realm governance APIs.
- [x] 4.3 Add `@rezics/api` hooks and query keys for the realm community + foundation realm governance APIs.
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
- [ ] 5.6 Add the moderator-only Moderation tab as the product entry for the foundation's queue, reports, sanctions, and audit views.

## 6. Verification

- [ ] 6.1 Run `bun --filter=@rezics/contract test`.
- [ ] 6.2 Run targeted `package/server` realm, post, and search tests.
- [ ] 6.3 Run targeted `package/api` realm hook tests.
- [ ] 6.4 Run targeted `package/app` realm console, realm feed, about tab, moderation tab, tag tab, pinboard, and composer tests.
- [ ] 6.5 Run `bun run check:convention`.
- [ ] 6.6 Run `bun run format:check`.
- [ ] 6.7 Run `openspec validate complete-realm-community-governance --strict`.
