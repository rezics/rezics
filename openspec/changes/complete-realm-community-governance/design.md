## Current State

Realm already has strong foundations: public/private and official status, membership roles, join/leave/mute subscription edges, realm-scoped tag applications and votes, realm feeds, a management page, and helper hooks for current membership. The weakness is product depth. There is no realm-native queue, rules acknowledgement, sanctions, pinned/locked/archived content lifecycle, escalation path, or clear distinction between realm moderators and global staff.

Mature references split these responsibilities. Discourse treats categories and moderators as a governance layer over topics/posts. Flarum keeps tags/flags/suspend as modular capabilities. BookWyrm has smaller community admin/report surfaces. Rezics should apply the same product ideas through Realm, Unit, Post, Subscription, and policy primitives rather than copying category/topic models.

## Target Design

### Governance Boundary

Realm governance is scoped to a realm:

```txt
Global staff policy
└─ can override/escalate across realms

Realm owner/admin/moderator policy
└─ can manage members, rules, tags, queue, and content only inside that realm

Regular member/lurker policy
└─ can read/post/react depending on realm visibility, rules, and account state
```

The server exposes realm action policies such as `realm.rules.update`, `realm.member.role.update`, `realm.queue.decide`, `realm.content.pin`, `realm.content.lock`, and `realm.report.escalate`.

### Realm Management Console

`package/app` owns realm management routes below the realm detail context:

- overview and health;
- rules and join requirements;
- member list, role changes, mute/remove/ban-from-realm;
- moderation queue and report detail;
- pinned/announcement content;
- tag curation;
- settings and deletion/transfer ownership.

This is not `package/admin`. Operators may still see realm diagnostics in `package/admin`, but community moderation lives in the public app product context.

### Moderation Workflow

Realm reports create realm moderation items and optionally site-wide moderation cases:

```txt
report -> realm queue item -> mod decision
                         \-> escalate -> site moderation case
```

Realm decisions include hide from realm, remove from realm feed, lock thread, archive thread, warn member, mute member in realm, remove member, ban member from realm, reject report, duplicate, or escalate. Site-wide account actions remain governed by `complete-site-governance-permissions`.

### Community Lifecycle

Realms gain community affordances:

- rules acknowledgement for joining or first posting;
- member state: active, muted, removed, banned, pending when private/approval-required;
- pinned posts and announcements;
- locked and archived content states;
- member-only and public preview behavior;
- moderator filters and audit badges in feeds.

### Search And Notifications

Search indexes include realm visibility and lifecycle state so archived/hidden content does not surface incorrectly. Notifications inform users about rule updates, moderation decisions, membership changes, queue assignments, and escalations.

## Alternatives Considered

- Put realm moderation in `package/admin`: rejected because realm moderators are community operators, not platform operators.
- Use only global moderation cases: rejected because many realm-specific decisions should not require site staff.
- Treat realms as Discourse categories directly: rejected because Rezics realms also own tag context, work/community aggregation, and library-specific semantics.

## Risks

- Realm moderation and global moderation can conflict. Mitigate by explicit escalation/linkage and policy precedence.
- Moderator UI can become too admin-like. Mitigate by keeping it contextual to the realm and using product-side language.
- Private/member-only visibility can leak through search or notifications. Mitigate with index filters, query tests, and safe DTOs.

## Rollout Plan

1. Add realm governance contracts and schema fields.
2. Implement realm policy actions and tests.
3. Add queue/report/decision APIs and link escalation to site moderation cases.
4. Expand realm management routes in `package/app`.
5. Update feed, composer, search, and notification behavior.
6. Add seed scenarios for public, private, moderated, and high-traffic realms.
