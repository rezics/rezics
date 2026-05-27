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

### Existing Infrastructure Reuse

Rules, pins, announcements, and realm tag navigation must build on the
infrastructure already present in Rezics:

```txt
Realm.extra
├─ rule          -> rule Unit id
├─ about         -> about/sidebar Post Unit id
├─ pinboard      -> ordered pinned Unit ids
├─ announcement  -> ordered special-surface announcement Unit ids
└─ tagTree       -> realm tag navigation structure

Unit / UnitTranslation
└─ language-specific display and content source resolution

package/app/src/pinboard
└─ public pinboard display + moderator reorder/edit/admin primitives
```

This change must not introduce a parallel `RealmRule` content surface or a
separate pinboard model unless a later spec proves that Realm.extra cannot
support the required behavior. `Realm.extra.announcement` keeps its existing
special-surface meaning; ordinary realm announcements should be regular realm
Posts surfaced through feed, tag, notification, or pinboard flows rather than a
second announcement system. New normalized state is reserved for behavior that
Realm.extra cannot represent safely: rule acknowledgement/version policy,
member state, moderation queue/events, and per-realm lifecycle flags such as
lock/archive/hide.

### Rule Content And I18n

Realm rules have a stable realm-owned identity and multilingual content. The
default design is:

```txt
Realm.extra.rule
      │
      ▼
Rule Unit
  ├─ UnitTranslation(en).sourceUnitId      ─▶ English rule Post
  ├─ UnitTranslation(zh-hant).sourceUnitId ─▶ Traditional Chinese rule Post
  └─ UnitTranslation(ja).sourceUnitId      ─▶ Japanese rule Post
```

The rule Unit is a POST Unit so `Realm.extra.rule` remains compatible with the
existing realm-extra validation and Post history/moderation semantics. It is
also the stable object referenced by acknowledgement policy. Each
UnitTranslation resolves the localized title/summary/description and may point
to a language-specific rule Post through `sourceUnitId` when the rule body needs
a distinct localized Post body. Rendering follows the standard UnitTranslation
fallback chain before falling back to the realm default language.

Rule acknowledgement state keys off `(realmUnitId, ruleUnitId, version, userId)`.
The accepted language may be recorded for audit/debugging, but language is not
the canonical rule version.

### Realm Page IA

The realm detail page remains tab-based. `Feed` is the default product entry
because a realm is an active community space first. The feed is not a bare list:
it carries current pinned content, required rule/update prompts, and quick
filters above the discussion stream. Stable community information lives in an
`About` tab and, where useful, a desktop summary sidebar.

```txt
Realm header
└─ Tabs
   ├─ Feed        default; pinboard, prompts, filters, discussion stream
   ├─ Tags        realm tag navigation and curation
   ├─ Members     member directory where visible
   ├─ About       rules, about, stats, join policy, moderator context
   └─ Moderation  moderator-only; queue, reports, sanctions, audit
```

Desktop layouts may add a right sidebar for persistent summary content, but the
sidebar is secondary to the tabs. The sidebar is appropriate for rule/about
summary, join state, membership stats, and moderator badges while browsing
Feed/Tags/Members. Mobile renders the same information inline inside Feed/About
or the active tab rather than as a separate sidebar.

### Pinboard UI

The public realm pinboard is a named `Pinboard` surface, not a generic
"highlights" section. It should render as a horizontal carousel/rail using the
existing `@rezics/ui` carousel primitives. Public cards are optimized for
scanning pinned community content:

```txt
Pinboard
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   >
│ cover/title│ │ title      │ │ title      │ │ title      │
│ author     │ │ author     │ │ author     │ │ author     │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

The pinboard's primary public placement is above the discussion stream on the
default Feed tab. The About tab may link to or summarize pinned content, but it
is not the primary pinboard surface. The moderator/admin reorder surface can
remain a vertical list because it is an editing workflow. The public realm page
should not show the current vertical pin list as the final product UI.

### Realm Tag Tab

Realm tags are a product surface, not only a feed filter. `Realm.extra.tagTree`
provides navigation structure while actual filtering and classification still
operate on tag Unit ids. The structure can be rendered in three modes:

- `flat` — all enabled tag Units as compact chips/cards; default for new realms.
- `grouped` — two-level category panels inspired by forum category boards.
- `tree` — traditional expandable category navigation for arbitrary depth.

The tree is structural semantics only. Group/category nodes help people browse;
they do not create new classification rows by themselves. Tag nodes resolve
their labels from Tag Unit `UnitTranslation`. Group/category nodes must also be
multilingual, either by referencing a Unit or by an explicitly modeled
translation map; raw single-language labels are not acceptable as the long-term
contract.

Realm tag display preference belongs with realm-owned configuration, such as a
typed `Realm.extra.tagView` value:

```txt
tagView: {
  defaultStyle: "flat" | "grouped" | "tree",
  allowViewerSwitch: boolean
}
```

This keeps the view preference close to `tagTree` while leaving tag
classification rows (`RealmTagApplication`) focused on actual Unit/tag
relationships.

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
