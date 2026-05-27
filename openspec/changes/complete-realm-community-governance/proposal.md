## Why

Realm is Rezics' community boundary, but current realm behavior is closer to discovery, membership, feeds, and tag curation than a mature community product. The next step is to make each realm operate like a real moderated community while keeping realm moderation separate from both global staff governance and the `package/admin` operations panel.

## What Changes

- Add realm rules, role policies, moderation queues, member management, content lifecycle controls, and realm-scoped safety settings.
- Give realm owners/admins/moderators a product-side management console under realm routes, not under `package/admin`.
- Add realm-scoped reports and moderator decisions that can be escalated to the site-wide moderation case system from `complete-site-governance-permissions`.
- Expand realm feeds from a list of `UnitRealm`/post membership into a community experience: pinned items, locked/archived threads, announcements, sort/filter presets, member-only areas, and moderator context.
- Reuse existing realm community infrastructure for rules, pins, and tags: `Realm.extra.rule`, `Realm.extra.pinboard`, `Realm.extra.announcement`, `Realm.extra.tagTree`, `UnitTranslation`, the pinboard feature, and existing carousel primitives remain the product foundations.
- Add product UI design requirements for the realm Feed default tab, About tab, rule acknowledgement surfaces, pinboard carousel cards, Moderation tab, and the tag tab's flat/grouped/tree display modes.
- Extend realm metadata and management surfaces so all major realm-owned text remains multilingual through `UnitTranslation` or explicitly modeled translation entries rather than raw single-language labels.
- Add role-granting safeguards so realm owners cannot silently create site staff and site staff cannot accidentally mutate realm-specific governance without policy/audit.
- Use existing Realm, RealmMember, UnitRealm, Post, RealmTag, Subscription, Notification, search, and history infrastructure; do not depend on `introduce-api-unit-store`.
- **BREAKING**: realm management UI and APIs SHALL move from ad hoc owner/admin checks to explicit realm governance actions.

## Capabilities

### New Capabilities

- `realm-governance-policy`: Realm-scoped action policy, role hierarchy, and delegation rules.
- `realm-moderation-workflow`: Realm report intake, mod queue, decisions, sanctions, escalation, and case linkage.
- `realm-management-console`: Product-side owner/admin/moderator management routes inside `package/app`.
- `realm-community-lifecycle`: Rules, announcements, pins, locked/archived content, member state, and onboarding flows.

### Modified Capabilities

- `realm-frontend`: Expand realm detail/manage routes into a complete community surface with moderator states.
- `realm-membership-me`: Expose richer current-user membership and capability metadata.
- `realm-feed-query`: Add moderator filters, pinned/locked/archived states, and member visibility behavior.
- `realm-forum-composer`: Apply realm rules, posting permissions, lock/archive constraints, and mod feedback.
- `realm-join-rule-consent`: Expand join consent into rules acknowledgement and private/member-only handling.
- `realm-tag-unit`: Include moderation permissions and audit for realm-scoped tag curation.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/api`, `package/app`, `package/search`, `package/notification`, `package/job-runner`, and seed fixtures.
- Database impact: add only the governance state not already represented by existing infrastructure: rule acknowledgement/version policy, mod action/report/queue state, member state, lock/archive/hide metadata, and moderation audit fields. Rule content and pinboard ordering reuse Realm extra and Unit/Post/UnitTranslation primitives unless a spec explicitly documents a new normalized field.
- UI impact: `package/app` gains realm Feed, About, rule, member, Moderation, pinboard, tag, and settings surfaces using Rezics design-system rhythm, `@rezics/ui` primitives, and the existing carousel/pinboard foundations.
- Migration/backward compatibility: existing realm owners/admins/moderators retain equivalent permissions; existing member rows default to active state; existing feeds remain visible under default filters.
