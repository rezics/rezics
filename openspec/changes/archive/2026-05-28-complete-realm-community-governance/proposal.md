## Why

Realm is Rezics' community boundary, but current realm behavior is closer to discovery, membership, feeds, and tag curation than a mature community product. The next step is to make each realm operate like a real moderated community.

This change owns the realm **community product**: feed, rules UX, pinboard, tag tab, member surfaces, and the realm management console. The realm **authorization mechanism** — realm policy actions, the role hierarchy/capability model, the moderation queue/decision/escalation engine, content lock/archive/hide state, and audit — lives in `complete-platform-authorization`, which this change consumes. Operational back-office panels remain in `complete-admin-operations-panel`.

## What Changes

- Give realm owners/admins/moderators a product-side management console under realm routes (not `package/admin`) that drives the foundation's realm policy, queue, and sanction APIs.
- Expand realm feeds from a list of `UnitRealm`/post membership into a community experience: pinned items, locked/archived/hidden states (rendered from the foundation's content-moderation model), announcements, sort/filter presets, member-only areas, and moderator context.
- Add realm rules content and versioned acknowledgement surfaces for joining, first posting, and material rule updates, built on `Realm.extra.rule` + a POST rule Unit with `UnitTranslation` fallback.
- Reuse existing realm community infrastructure: `Realm.extra.rule`, `Realm.extra.pinboard`, `Realm.extra.announcement`, `Realm.extra.tagTree`, `UnitTranslation`, the pinboard feature, and existing carousel primitives.
- Add product UI for the realm Feed default tab, About tab, rule acknowledgement surfaces, pinboard carousel cards, the moderator-only Moderation tab, and the tag tab's flat/grouped/tree display modes.
- Extend realm metadata and management so all major realm-owned text stays multilingual through `UnitTranslation` rather than raw single-language labels.
- Expose richer current-user membership and capability metadata (consuming the foundation's capability hints) for realm UI rendering.
- **BREAKING**: realm management UI and APIs SHALL move from ad hoc owner/admin checks to the explicit realm governance actions defined in `complete-platform-authorization`.

## Capabilities

### New Capabilities

- `realm-management-console`: Product-side owner/admin/moderator management routes inside `package/app`.
- `realm-community-lifecycle`: Rules, announcements, pins, member-only/preview behavior, and onboarding flows.

### Modified Capabilities

- `realm-frontend`: Expand realm detail/manage routes into a complete community surface with moderator states.
- `realm-membership-me`: Expose richer current-user membership and capability metadata.
- `realm-feed-query`: Add moderator filters, pinned/locked/archived states, and member visibility behavior.
- `realm-forum-composer`: Apply realm rules, posting permissions, lock/archive constraints, and mod feedback.
- `realm-join-rule-consent`: Expand join consent into rules acknowledgement and private/member-only handling.
- `realm-tag-unit`: Realm-scoped tag curation surfaces and display modes (curation permissions/audit come from the foundation).

## Impact

- Affected packages: `package/contract`, `package/server`, `package/api`, `package/app`, `package/search`, `package/notification`, `package/job-runner`, and seed fixtures.
- Database impact: add only realm community product state not owned by the foundation: rule acknowledgement/version policy, rule content references, tag view preference, and member-onboarding flags. Realm role/capability, member state, queue/events, content lock/archive/hide state, and moderation audit are defined by `complete-platform-authorization`.
- UI impact: `package/app` gains realm Feed, About, rule, member, Moderation, pinboard, tag, and settings surfaces using Rezics design-system rhythm, `@rezics/ui` primitives, and the existing carousel/pinboard foundations.
- Dependency: requires `complete-platform-authorization` for realm policy, capabilities, moderation workflow, content-moderation state, and audit.
- Migration/backward compatibility: existing realm owners/admins/moderators retain equivalent permissions; existing member rows default to active state; existing feeds remain visible under default filters.
