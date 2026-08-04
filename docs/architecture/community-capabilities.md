# Community capabilities

This document owns the social organization of catalog and published content:
Feeds, reactions, follows, collections, Realms, Zones, Docks, tags, reviews,
scores, personal progress, recommendations, and reports.

Planning context:

- [Outline: content feed](https://outline.rezics.com/doc/content-feed-idj9eU2asb)
- [Outline: follow](https://outline.rezics.com/doc/follow-TUHoEQ8NMT)
- [Outline: collection](https://outline.rezics.com/doc/collection-q4D7edPSbN)
- [Outline: Realm](https://outline.rezics.com/doc/realm-WgzNSUg2tX)
- [Outline: Zone and Dock](https://outline.rezics.com/doc/zone-dock-XsBCoT5PMx)
- [Outline: tags](https://outline.rezics.com/doc/tag-myz7cKHbzB)
- [Outline: score](https://outline.rezics.com/doc/score-7h0C100u9x)
- [Outline: progress](https://outline.rezics.com/doc/progress-UIOizb6Imc)

## Feeds and lightweight social actions

```progress
id: feed.composable-content-list
status: open
goal: Render bounded live content feeds with shared filtering and product-owned cards across home, Realm, Zone, Profile, collection, and search contexts.
depends:
  - publishing.v1-experience
accept:
  - The API and Search backends share documented content-kind, language, Realm, tag, subject, sort, cursor, and visibility semantics.
  - Each supported content kind owns its accessible card content while shared actions, continuation, loading, empty, and error behavior remain consistent.
  - Context such as Realm publication is explicit and cannot change the underlying Post identity or leak unreadable content.
verify:
  - Run filter library, feed API, query, cursor, card, selector, continuation, context, and route tests.
  - Exercise each feed host, content kind, filter combination, continuation, empty result, stale cursor, and access boundary.
```

```progress
id: social.reactions
status: open
goal: Let signed-in people react to supported targets with bounded, reversible, concurrency-safe counts.
depends:
  - identity.profiles-and-settings
  - posts.core-publishing
accept:
  - Reaction kinds, eligible targets, optional Realm context, limits, and viewer state use one typed contract.
  - Add, change, remove, retry, and concurrent reactions update canonical state and rebuildable aggregates atomically.
  - Feed, detail, notification, ranking, and moderation consumers cannot observe counts that contradict the underlying reactions.
verify:
  - Run reaction schema, API, aggregate, concurrency, feed-action, and presentation tests.
  - Exercise add, replace, remove, duplicate retry, quota refusal, inaccessible target, and concurrent reactions.
```

```progress
id: social.following
status: open
goal: Let a Profile follow supported Units and receive a stable personalized following view.
depends:
  - identity.profiles-and-settings
  - catalog.unit-lifecycle
accept:
  - Follow, unfollow, membership-triggered follow, list, count, cursor, and cache behavior use one canonical subscription relation.
  - Following never changes ownership or visibility and unreadable targets disappear without exposing their identity.
  - The following page and relevant Unit surfaces use live data and recover from repeated or stale actions.
verify:
  - Run following service, cursor, settings, cache, button, route, and page tests.
  - Exercise follow, duplicate follow, unfollow, Realm join, inaccessible target, pagination, and stale-cache cases.
```

```progress
id: social.follow-notification-preferences
status: open
goal: Turn a follow into explicit per-target notification choices that a person can change or disable.
depends:
  - social.following
  - communication.in-app-notifications
accept:
  - The follow control exposes notification purposes and unfollow in one localized, accessible management surface.
  - Realm membership establishes the approved default follow and notification state without overwriting an existing choice.
  - Preference changes affect only future optional notifications and remain consistent across devices and retries.
verify:
  - Run follow-settings, Realm membership, notification-policy, preference UI, and cache tests.
  - Exercise first follow, existing preference, Realm join, per-purpose toggle, unfollow, retry, and multi-device cases.
```

## Collections

```progress
id: collections.organize-units
status: open
goal: Let a Profile create, publish, order, and share collections of readable Units, including the reserved Favorites collection.
depends:
  - catalog.unit-lifecycle
  - identity.profiles-and-settings
accept:
  - Collection metadata, localizations, visibility, ownership, items, manual order, publishers, Realm publications, history, and deletion use live contracts.
  - Add, remove, move, deduplicate, paginate, and reorder operations preserve item identity and collection counts under retries and concurrency.
  - Favorites keeps its reserved purpose while following the approved metadata and privacy behavior.
verify:
  - Run collection schema, structure, favorites, API, cache, management, route, history, and feed tests.
  - Complete private, public, collaborative, Favorites, reorder, duplicate, concurrent, and deletion journeys.
```

The remaining Favorites metadata and removal-feedback refinements are tracked
by `collections.favorites-metadata` and
`collections.favorite-removal-feedback` beside their implementation owners.

```progress
id: collections.presentation-and-dynamic-views
status: open
goal: Present flat, nested, shelf, and dynamic collection views only when their data and interaction contracts are defined.
depends:
  - collections.organize-units
  - feed.composable-content-list
accept:
  - Flat, nested, and shelf presentations declare eligible item kinds, grouping, ordering, density, and accessible fallback behavior.
  - Dynamic collections store a versioned Filter document rather than duplicated items and explain when results were evaluated.
  - Add-to-collection and main-variant preference behavior remains consistent across presentations and failed preference reads.
verify:
  - Run collection presentation, Filter document, variant preference, feed, ordering, and accessibility tests.
  - Have a maintainer accept flat, nested, shelf, dynamic, empty, unsupported-item, and stale-filter journeys.
```

## Realms

```progress
id: realms.community-lifecycle
status: open
goal: Let communities create and operate Realms without taking ownership of independently published content.
depends:
  - access.unit-collaboration
  - social.following
accept:
  - Realm identity, localization, membership, roles, visibility, configuration, pages, rules, tags, wiki, feed, and lifecycle use one permission model.
  - Joining, leaving, inviting, role change, follow defaults, suspension, deletion, and restoration preserve member and subscriber truth.
  - Realm removal of a published Unit changes only its Realm relation unless the Realm owns that content under an explicit contract.
verify:
  - Run Realm schema, service, membership, permission, configuration, page, API, routing, and presentation tests.
  - Exercise public and private Realm creation through join, role change, publication, removal, leave, suspension, and restoration.
```

```progress
id: realms.publication-context
status: open
goal: Let authors publish one Unit into multiple Realms while each Realm keeps independent ordering, status, context, and moderation.
depends:
  - realms.community-lifecycle
  - posts.core-publishing
accept:
  - Publication relations preserve explicit order and status without inventing a hidden main Realm or changing Unit identity.
  - Feed cards, Post detail, Realm routes, notifications, and search carry the chosen Realm context intentionally.
  - Add, reorder, approve, restrict, remove, retry, and concurrent moderation remain scoped to one Realm relation.
verify:
  - Run Realm publication, Post context, mounted search, feed, management, route, and moderation tests.
  - Publish one Post to several Realms and exercise context selection, ordering, removal, restriction, and concurrent review.
```

```progress
id: realms.rules-and-moderation
status: open
goal: Give each Realm reviewable rules and moderation that acts on Realm relationships before platform-owned content.
depends:
  - realms.community-lifecycle
  - moderation.reports
accept:
  - Versioned rules, required acknowledgements, membership effects, reports, cases, actions, reversals, notes, and audits stay linked to the same Realm and target.
  - Moderators can pin, restrict, remove, restore, and annotate Realm content only within their granted scope.
  - Policy changes, acknowledgement races, duplicate reports, reversed actions, appeals, and operator escalation have explicit behavior.
verify:
  - Run Realm rules, acknowledgement, moderation, report, audit, permission, queue, and web management tests.
  - Exercise rule publication, acknowledgement, report, action, reversal, appeal, and platform escalation with distinct roles.
```

```progress
id: realms.taxonomy-and-wiki
status: open
goal: Let a Realm maintain a localized taxonomy and navigable Wiki knowledge space through shared Tag and Wiki contracts.
depends:
  - realms.community-lifecycle
  - posts.wiki-publishing
  - tags.classification
accept:
  - Taxonomy drafts, publication, hierarchy, localized labels, descriptions, access modes, and Wiki navigation use stable Unit and Block identities.
  - Realm Wiki navigation resolves only readable Wiki Posts and host-owned Navigation documents.
  - Editors can preview, validate, publish, revise, and recover taxonomy and navigation changes without leaking drafts.
verify:
  - Run Realm taxonomy draft, content-structure, Wiki navigation, access-mode, Block resolver, history, and web editor tests.
  - Complete taxonomy and Wiki navigation draft-to-publication journeys with invalid, stale, and unauthorized edits.
```

Long-form taxonomy descriptions remain tracked by
`wiki.taxonomy-descriptions` beside the content-structure contract.

```progress
id: realms.reputation-levels
status: open
goal: Let each Realm define transparent contribution experience and levels without creating a global engagement-farming score.
depends:
  - realms.rules-and-moderation
accept:
  - A Realm defines versioned qualifying events, weights, limits, decay or permanence, levels, and visible explanations.
  - Experience derives from auditable events and can be rebuilt, corrected, appealed, and protected from duplicate or abusive activity.
  - Permissions never depend on an unexplained score and global collectible or trading systems remain outside this capability.
verify:
  - Run reputation policy, event, projection, rebuild, abuse-limit, correction, appeal, and presentation tests.
  - Exercise normal contribution, duplicate event, removed content, policy revision, correction, and appeal cases.
```

## Zones and Docks

```progress
id: zones.composable-surfaces
status: open
goal: Let authorized creators build localized query-driven Zones from safe Block pages, navigation, and search configuration.
depends:
  - content.block-documents
  - feed.composable-content-list
  - search.live-discovery
accept:
  - Zone identity, localization, theme, page addresses, layout, navigation, Filter documents, search, revisions, and publication use live contracts.
  - Zone membership is always derived from declared queries or Blocks rather than an implied ownership relation.
  - Preview, publish, route, persistent context, invalid Block, unreadable reference, and stale revision behavior are explicit.
verify:
  - Run Zone schema, page, navigation, Filter, search, Block resolver, history, API, route, management, and rendering tests.
  - Complete a catalog-library Zone and a Wiki Zone from creation through publication, navigation, search, revision, and recovery.
```

```progress
id: docks.unit-surface-composition
status: open
goal: Let each supported Unit surface insert safe host-owned Docks without replacing product-owned layout responsibilities.
depends:
  - content.block-documents
  - catalog.v1-experience
accept:
  - Realm, Book, Media, Software, and other approved surfaces declare Dock slots, supported Blocks, host-owned resources, and responsive placement.
  - Realm may own its complementary rail while catalog products retain official sections and insert Docks only at approved slots.
  - Dock edit, preview, publication, history, unavailable reference, unsupported Block, and mobile fallback behavior are explicit.
verify:
  - Run Dock schema, host-policy, access, renderer, manager, history, Unit detail, and responsive contract tests.
  - Have a maintainer accept Realm and catalog Dock journeys on supported desktop and mobile layouts.
```

```progress
id: zones.statistics-block
status: open
goal: Let Zone creators present explicitly scoped, named, and timestamped statistics without inventing one universal Zone content count.
depends:
  - zones.composable-surfaces
  - analytics.localized-content-metrics
accept:
  - Each statistic declares its label, Unit or Post population, Realm or Zone scope, Filter, measure, exact or approximate semantics, and evaluation time.
  - Multiple overlapping statistics may coexist and never imply that a Zone owns or has one deduplicated total of all matching content.
  - Permissions, query limits, projection freshness, localization, empty state, and unavailable metrics are visible and safe.
verify:
  - Run Statistics Block schema, Filter, metric query, permission, Block resolver, rendering, freshness, and localization tests.
  - Build the light-novel-library example from the Outline decision and verify overlapping, approximate, private, stale, and unavailable measures.
```

## Tags, reviews, progress, and recommendations

```progress
id: tags.classification
status: open
goal: Let communities and people classify Units through explicit global, Realm, policy, and personal tag relations.
depends:
  - catalog.unit-lifecycle
  - realms.community-lifecycle
accept:
  - Tag identity, localization, sources, contexts, application kinds, votes, direct curation, thresholds, and effective state use one typed vocabulary.
  - Global and Realm votes remain independent, while policy and personal applications enforce their own authority.
  - Detail, management, feed, search, filter, and history surfaces present the same effective classification and provenance.
verify:
  - Run Tag schema, curation, landscape, ranking, API, vote-context, management, presentation, feed, and search tests.
  - Exercise global vote, Realm vote, policy application, personal tag, threshold change, removal, retry, and concurrency.
```

```progress
id: tags.versioned-structures
status: open
goal: Let communities organize Tags into ordered, versioned structures with immutable accepted paths.
depends:
  - tags.classification
accept:
  - A Tag Structure has Unit identity, localized metadata, versioned definitions, ordered paths, accepted edges, and explicit publication state.
  - Path identity and hierarchy edits preserve history and reject cycles, duplicate members, invalid roots, and cross-structure edges.
  - Structure detail, editing, filtering options, and Realm taxonomy consume the same accepted version.
verify:
  - Run Tag Structure definition, hierarchy, service, API, editor, path, list, detail, and history tests.
  - Exercise create, draft, reorder, publish, revise, cycle, duplicate, and historical-version cases.
```

```progress
id: tags.hierarchy-reachability
status: open
goal: Provide a versioned reachability projection so Feed, Search, and filters share bounded ancestor and descendant semantics.
depends:
  - tags.versioned-structures
accept:
  - The projection derives only from the accepted structure version and records ancestor, descendant, minimum depth, and generation.
  - Rebuild, promotion, rollback, and concurrent structure publication never mix generations.
  - Execution filters and localized option trees remain separate contracts with explicit depth and count limits.
verify:
  - Run projection derivation, generation, promotion, rollback, query, Filter, Search, and option-tree tests.
  - Rebuild a branching structure and compare ancestor and descendant results before and after a version promotion.
```

```progress
id: reviews.realm-scoring
status: open
goal: Let people publish Reviews and score a Unit in an explicit Realm scoring context.
depends:
  - posts.core-publishing
  - realms.community-lifecycle
accept:
  - Review publication, target, language, Realm contexts, attached scores, status, visibility, revision, and discussion remain one Post lifecycle.
  - V1 score values and dimensions are officially defined and localized while the schema can add Realm-owned dimensions through a versioned contract.
  - Per-viewer scores and aggregates remain bounded, concurrency-safe, rebuildable, and filterable by declared context.
verify:
  - Run Review, score, association, aggregate, Realm context, feed, filter, API, composer, and overview tests.
  - Complete global-default and Realm-context Review journeys including edit, remove, retry, concurrent score, and aggregate rebuild.
```

```progress
id: progress.personal-tracking
status: open
goal: Let a Profile track status, events, time, and bounded completion for supported catalog Units.
depends:
  - catalog.v1-experience
accept:
  - Status, privacy, current position, total time, completed count, rating-independent events, and kind-specific estimates have explicit units and bounds.
  - Update, complete, reopen, import, event history, summary, statistics, and cache behavior are idempotent and live.
  - Book, Media, Software, and unsupported kinds expose only meaningful controls; GameBook Journey state remains separate.
verify:
  - Run progress schema, API, event, import, estimate, cache, provider, dialog, page, and route tests.
  - Exercise new, update, complete, reopen, private, import, duplicate retry, invalid bound, and concurrent update cases.
```

```progress
id: recommendations.personalized
status: open
goal: Recommend readable Units and Posts with understandable reasons, bounded tracking, and safe fallback.
depends:
  - feed.composable-content-list
  - social.reactions
  - social.following
  - progress.personal-tracking
accept:
  - Candidate generation, ranking, diversity, exclusions, freshness, context, and fallback use versioned policies and readable source data.
  - Recommendation reasons are truthful and localized, and impression or action tracking is consent-aware, deduplicated, and bounded.
  - Worker lag, missing personalization, deleted content, model failure, and cold start degrade to an explicit safe feed.
verify:
  - Run recommendation context, policy, ranking, related-content, tracking, projection, worker, health, API, and web tests.
  - Exercise cold start, personalized result, exclusion, duplicate impression, stale worker, deleted target, and fallback cases.
```

```progress
id: moderation.reports
status: open
goal: Let a person report supported content and follow the visible state of their reports without gaining moderation access.
depends:
  - identity.profiles-and-settings
  - catalog.unit-lifecycle
accept:
  - Report targets, reasons, optional context, evidence, duplicate policy, state, privacy, and routing are explicit.
  - Reporters can submit and list their reports while Realm and platform moderators see only cases within their authority.
  - Triage, action, closure, appeal, notification, retention, and audit behavior remain linked without exposing another reporter.
verify:
  - Run report schema, API, selection, route, dialog, moderation, notification, privacy, and audit tests.
  - Exercise submit, duplicate, unauthorized target, Realm routing, platform routing, closure, appeal, and private-list cases.
```

## Community milestone

```progress
id: community.v1-experience
status: open
goal: Make v1 community discovery, organization, participation, curation, and safety complete around shared Units.
depends:
  - publishing.v1-experience
  - feed.composable-content-list
  - social.reactions
  - social.following
  - collections.organize-units
  - realms.community-lifecycle
  - realms.publication-context
  - realms.rules-and-moderation
  - realms.taxonomy-and-wiki
  - zones.composable-surfaces
  - docks.unit-surface-composition
  - tags.classification
  - tags.versioned-structures
  - reviews.realm-scoring
  - progress.personal-tracking
  - recommendations.personalized
  - moderation.reports
accept:
  - People can discover, follow, organize, discuss, review, classify, track, and report content through live coherent journeys.
  - Realm and Zone contexts organize or present content without changing its independent identity, ownership, access, or history.
  - Aggregates, feeds, recommendations, notifications, and moderation remain consistent under retries, concurrency, deletion, and visibility change.
verify:
  - Run community-related schema, service, API, generated-client, web, worker, and production build checks.
  - Execute the community acceptance matrix with visitor, member, contributor, moderator, and operator roles.
```
