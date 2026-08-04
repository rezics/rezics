# Product capability map

This is the human entry point to the complete Progress graph. It maps current
repository owners and active Outline product decisions to outcome Items; it
does not duplicate their acceptance criteria. Follow the Item ID to its owning
architecture document, source contract, legal draft, or runbook.

A directory, route, schema, or mockup proves that work exists, not that the
product outcome is done. Items stay `open` until every acceptance condition is
true and every verification procedure has actually been completed.

## Product outcome chains

| Chain                         | Owning document                                         | Milestone                  |
| ----------------------------- | ------------------------------------------------------- | -------------------------- |
| Shared platform               | [Platform capabilities](./platform-capabilities.md)     | `platform.v1-foundation`   |
| Unit catalog                  | [Catalog capabilities](./catalog-capabilities.md)       | `catalog.v1-experience`    |
| Authoring and publishing      | [Publishing capabilities](./publishing-capabilities.md) | `publishing.v1-experience` |
| Communities and participation | [Community capabilities](./community-capabilities.md)   | `community.v1-experience`  |
| Search and discovery          | [Discovery capabilities](./discovery-capabilities.md)   | `discovery.v1-experience`  |
| Delivery and recovery         | [Platform delivery](../operations/platform-delivery.md) | `operations.v1-delivery`   |
| Approved future outcomes      | [Future capabilities](./future-capabilities.md)         | Not a v1 dependency        |

The graph flows from shared identity and Unit contracts into publishing,
community, discovery, and production delivery. Cross-chain dependencies name
real completion prerequisites only. Approved future outcomes stay in the graph
without becoming v1 dependencies; an Outline idea remains outside the graph
when it has no observable product result or is explicitly obsolete, abandoned,
or superseded.

## Repository coverage

### Web feature owners

| `apps/web/features` owner  | Progress outcome                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application-shell`        | `experience.application-shell`                                                                                                                        |
| `auth`                     | `identity.account-lifecycle`                                                                                                                          |
| `blocks`                   | `content.block-documents`                                                                                                                             |
| `collections`              | `collections.organize-units`, `collections.presentation-and-dynamic-views`, and the two local Favorites Items                                         |
| `console`                  | `governance.operator-console`                                                                                                                         |
| `content-feed`             | `feed.composable-content-list`                                                                                                                        |
| `content-language-display` | `localization.application-and-content`                                                                                                                |
| `content-languages`        | `localization.application-and-content`, `content.capability-languages`                                                                                |
| `content-structure`        | `content-structure.book-and-media`, `content-structure.gamebook`                                                                                      |
| `create`                   | `studio.content-workspace`                                                                                                                            |
| `docks`                    | `docks.unit-surface-composition`                                                                                                                      |
| `editor`                   | `editor.portable-text-authoring`                                                                                                                      |
| `explore`                  | `discovery.home-experience`                                                                                                                           |
| `following`                | `social.following`, `social.follow-notification-preferences`                                                                                          |
| `governance`               | `access.unit-collaboration`, `governance.ownership-claims`                                                                                            |
| `history`                  | `history.published-revisions`, `history.revision-discussions`                                                                                         |
| `media`                    | `media.asset-lifecycle`                                                                                                                               |
| `notifications`            | `communication.in-app-notifications`                                                                                                                  |
| `ownership-claims`         | `governance.ownership-claims`                                                                                                                         |
| `polls`                    | `polls.unit-backed-options`                                                                                                                           |
| `posts`                    | `posts.core-publishing`, `discussions.threaded-replies`, `posts.picture-publishing`, `posts.wiki-publishing`, and the local targeting and Issue Items |
| `preferences`              | `identity.profiles-and-settings`                                                                                                                      |
| `preview-access`           | `release.development-preview-access`                                                                                                                  |
| `privacy`                  | `privacy.user-rights`, `privacy.retention-and-deletion`, `privacy.publish-policy`                                                                     |
| `profiles`                 | `identity.profiles-and-settings`                                                                                                                      |
| `progress`                 | `progress.personal-tracking`                                                                                                                          |
| `pwa`                      | `experience.installable-pwa`                                                                                                                          |
| `realm-publications`       | `realms.publication-context`                                                                                                                          |
| `realms`                   | the `realms.*` outcomes                                                                                                                               |
| `recommendations`          | `recommendations.personalized`                                                                                                                        |
| `reports`                  | `moderation.reports`                                                                                                                                  |
| `reviews`                  | `reviews.realm-scoring`                                                                                                                               |
| `search`                   | `search.live-discovery`, `search.advanced-builder`                                                                                                    |
| `settings`                 | `identity.profiles-and-settings`, `developer.api-access`                                                                                              |
| `slugs`                    | `addressing.public-unit-slugs`                                                                                                                        |
| `status-pages`             | `experience.application-shell`                                                                                                                        |
| `tags`                     | `tags.classification`, `tags.versioned-structures`, `tags.hierarchy-reachability`                                                                     |
| `units`                    | the `catalog.*`, `content-structure.*`, `docks.unit-surface-composition`, and `progress.personal-tracking` outcomes                                   |
| `zones`                    | `zones.composable-surfaces`                                                                                                                           |

### Main API route owners

| `services/main/src/services/api` owner | Progress outcome                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `association-proposals`                | `catalog.subject-associations`                                                                                                       |
| `audit`                                | `governance.operator-console`, `observability.runtime-signals`                                                                       |
| `collections`                          | `collections.organize-units`                                                                                                         |
| `content-structure`                    | `content-structure.book-and-media`, `content-structure.gamebook`                                                                     |
| `docks`                                | `docks.unit-surface-composition`                                                                                                     |
| `domain-extensions`                    | `catalog.books`, `catalog.media`, `catalog.software`, `catalog.series-and-releases`                                                  |
| `feed`                                 | `feed.composable-content-list`                                                                                                       |
| `governance`                           | `access.unit-collaboration`, `realms.rules-and-moderation`, `governance.ownership-claims`                                            |
| `health`                               | `operations.health-and-readiness`                                                                                                    |
| `history`                              | `history.published-revisions`                                                                                                        |
| `image-assets`                         | `media.asset-lifecycle`                                                                                                              |
| `messages`                             | `messaging.direct-conversations`                                                                                                     |
| `notifications`                        | `communication.in-app-notifications`                                                                                                 |
| `ownership-claims`                     | `governance.ownership-claims`                                                                                                        |
| `platform-access`                      | `access.unit-collaboration`, `governance.operator-console`                                                                           |
| `platform-users`                       | `identity.profiles-and-settings`, `governance.operator-console`                                                                      |
| `polls`                                | `polls.unit-backed-options`                                                                                                          |
| `posts`                                | `posts.core-publishing`, `discussions.threaded-replies`, `posts.picture-publishing`, `posts.wiki-publishing`, `posts.issue-workflow` |
| `progress`                             | `progress.personal-tracking`                                                                                                         |
| `quota-policies`                       | `developer.api-access`                                                                                                               |
| `reactions`                            | `social.reactions`                                                                                                                   |
| `realms`                               | the `realms.*` outcomes                                                                                                              |
| `recommendations`                      | `recommendations.personalized`                                                                                                       |
| `reports`                              | `moderation.reports`                                                                                                                 |
| `reviews`                              | `reviews.realm-scoring`                                                                                                              |
| `schema`                               | `developer.openapi-and-sdk`                                                                                                          |
| `search`                               | `search.live-discovery`, `search.advanced-builder`                                                                                   |
| `slug-addresses`                       | `addressing.public-unit-slugs`                                                                                                       |
| `tags`                                 | the `tags.*` outcomes                                                                                                                |
| `token-info`                           | `developer.api-access`                                                                                                               |
| `tokens`                               | `developer.api-access`, `auth.third-party-oauth`                                                                                     |
| `unit-resources`                       | `catalog.localized-metadata`, `catalog.credits-and-attributions`, `catalog.source-links`                                             |
| `units`                                | the `catalog.*` outcomes                                                                                                             |
| `users`                                | `identity.account-lifecycle`, `identity.profiles-and-settings`                                                                       |
| `wiki-navigation`                      | `realms.taxonomy-and-wiki`                                                                                                           |

### Main service owners

| `services/main/src/services` owner | Progress outcome                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `api`                              | `developer.openapi-and-sdk`                                                                  |
| `audit`                            | `governance.operator-console`, `observability.runtime-signals`                               |
| `auth`                             | `identity.account-lifecycle`, `developer.api-access`, `auth.third-party-oauth`               |
| `authorization`                    | `access.unit-collaboration`                                                                  |
| `blocks`                           | `content.block-documents`                                                                    |
| `bootstrap`                        | `operations.platform-installation`                                                           |
| `collection-structure`             | `collections.organize-units`                                                                 |
| `collections`                      | `collections.organize-units` and the local Favorites Items                                   |
| `config`                           | `operations.reproducible-local-platform`, `operations.secrets-and-service-identity`          |
| `content-metrics`                  | `analytics.localized-content-metrics`                                                        |
| `content-structure`                | `content-structure.book-and-media`, `content-structure.gamebook`, `realms.taxonomy-and-wiki` |
| `database`                         | `data.migration-integrity`                                                                   |
| `email`                            | `communication.transactional-email`                                                          |
| `entities`                         | `catalog.credits-and-attributions`, `catalog.subject-associations`, `catalog.source-links`   |
| `filter`                           | `filter.shared-query-contract`                                                               |
| `following`                        | `social.following`, `social.follow-notification-preferences`                                 |
| `governance`                       | `access.unit-collaboration`, `realms.rules-and-moderation`                                   |
| `health`                           | `operations.health-and-readiness`                                                            |
| `history`                          | `history.published-revisions`, `history.revision-discussions`                                |
| `i18n`                             | `localization.application-and-content`                                                       |
| `image-assets`                     | `media.asset-lifecycle`                                                                      |
| `notifications`                    | `communication.in-app-notifications`                                                         |
| `ordering`                         | ordered relations in collections, content structures, polls, Series, Realms, and tags        |
| `ownership-claims`                 | `governance.ownership-claims`                                                                |
| `pagination`                       | cursor contracts and `pagination.numbered-navigation-decision`                               |
| `platform-access`                  | `access.unit-collaboration`, `governance.operator-console`                                   |
| `platform-users`                   | `identity.profiles-and-settings`                                                             |
| `posts`                            | the `posts.*`, `discussions.threaded-replies`, and `reviews.realm-scoring` outcomes          |
| `realms`                           | the `realms.*` outcomes                                                                      |
| `recommendations`                  | `recommendations.personalized`                                                               |
| `search`                           | `search.live-discovery`                                                                      |
| `seed`                             | `seed.separate-scenario-programs`, `operations.platform-installation`                        |
| `storage`                          | `media.asset-lifecycle`, `operations.production-recovery`                                    |
| `studio`                           | `studio.content-workspace`, `studio.event-automations`                                       |
| `tag-structures`                   | `tags.versioned-structures`, `tags.hierarchy-reachability`                                   |
| `tags`                             | `tags.classification`                                                                        |
| `units`                            | the `catalog.*` outcomes                                                                     |
| `zones`                            | `zones.composable-surfaces`                                                                  |

### Workspace and delivery owners

| Owner                                                                                                    | Progress outcome                                                                                            |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/about`                                                                                             | `experience.about-and-policy-site`                                                                          |
| `aspire-apphost`                                                                                         | `operations.reproducible-local-platform`, `operations.health-and-readiness`                                 |
| `libraries/access`                                                                                       | `access.unit-collaboration`                                                                                 |
| `libraries/avatar`                                                                                       | `media.asset-lifecycle`                                                                                     |
| `libraries/block`                                                                                        | `content.block-documents`                                                                                   |
| `libraries/email`                                                                                        | `communication.transactional-email`                                                                         |
| `libraries/filter`                                                                                       | `filter.shared-query-contract`                                                                              |
| `libraries/fixture-client`, `libraries/fixture-data`                                                     | preview fixtures owned by `release.development-preview-access`; production journeys must use live contracts |
| `libraries/i18n`                                                                                         | `localization.application-and-content`                                                                      |
| `libraries/license`                                                                                      | `legal.unit-content-license`                                                                                |
| `libraries/observability`                                                                                | `observability.runtime-signals`                                                                             |
| `libraries/portable-text`                                                                                | `editor.portable-text-authoring`, `analytics.localized-content-metrics`                                     |
| `libraries/services` (including `main/openapi`, `main/openapi-fetch`, and `main/openapi-tanstack-query`) | `developer.openapi-and-sdk`                                                                                 |
| `libraries/slug`                                                                                         | `addressing.public-unit-slugs`                                                                              |
| `libraries/ui`                                                                                           | `experience.shared-design-system`, `developer.public-ui-package`                                            |
| `packages/api`                                                                                           | `developer.openapi-and-sdk`                                                                                 |
| `packages/brand`                                                                                         | `experience.about-and-policy-site`, `experience.shared-design-system`                                       |
| `deploy`, `.github/workflows`                                                                            | the `release.*` and `operations.*` outcomes                                                                 |

## Outline reconciliation

The active product collection is reconciled as follows:

| Outline topic                                  | Progress outcome or disposition                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access and Unit collaboration                  | `access.unit-collaboration`, `governance.ownership-claims`                                                                                        |
| Historical discussions                         | `history.revision-discussions`                                                                                                                    |
| Series                                         | `catalog.series-and-releases`                                                                                                                     |
| Before publish                                 | The pre-v1 cleanup rule is now repository policy; it is not an open product outcome.                                                              |
| Studio                                         | `studio.content-workspace`, `studio.event-automations`                                                                                            |
| Follow                                         | `social.following`, `social.follow-notification-preferences`                                                                                      |
| Bug list                                       | Split into the existing Seed, backup, manual release, Favorites, toast, language, OAuth, and policy Items.                                        |
| OAuth and API token                            | `developer.api-access`, `auth.third-party-oauth`                                                                                                  |
| Search                                         | `search.live-discovery`, `search.advanced-builder`                                                                                                |
| Experience and levels                          | `realms.reputation-levels`; the explicitly deferred global trading system is excluded.                                                            |
| “extra” retirement                             | Superseded and empty; no outcome remains.                                                                                                         |
| Block Schema                                   | `content.block-documents`, `editor.portable-text-authoring`, `zones.statistics-block`                                                             |
| History                                        | `history.published-revisions`, `history.revision-discussions`                                                                                     |
| Wiki                                           | `posts.wiki-publishing`, `realms.taxonomy-and-wiki`                                                                                               |
| Issue                                          | `posts.issue-workflow`                                                                                                                            |
| Content Structure and GameBook                 | `content-structure.book-and-media`, `content-structure.gamebook`; documents marked abandoned remain excluded.                                     |
| Collection                                     | `collections.organize-units`, `collections.presentation-and-dynamic-views`, and the local Favorites Items                                         |
| Editor                                         | `editor.portable-text-authoring`                                                                                                                  |
| Post and Picture Post                          | the `posts.*` outcomes                                                                                                                            |
| Score                                          | `reviews.realm-scoring`                                                                                                                           |
| Tag, features, and structures                  | the `tags.*` outcomes                                                                                                                             |
| Entity and source                              | `catalog.credits-and-attributions`, `catalog.subject-associations`, `catalog.source-links`, `catalog.external-source-resolution`                  |
| Personal Progress                              | `progress.personal-tracking`                                                                                                                      |
| Unit, content license, Poll, and catalog kinds | the `catalog.*`, `legal.unit-content-license`, and `polls.unit-backed-options` outcomes; Block Unit remains an explicit architecture exploration. |
| Content Feed                                   | `feed.composable-content-list`                                                                                                                    |
| Realm                                          | the `realms.*` outcomes                                                                                                                           |
| Zone and Dock                                  | `zones.composable-surfaces`, `docks.unit-surface-composition`                                                                                     |

The active developer collection is reconciled separately because it mixes
product decisions, engineering contracts, research, and working notes:

| Outline topic                                                                                        | Progress outcome or disposition                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| License and permission/governance schemes                                                            | `governance.repository-license`, `legal.unit-content-license`, `access.unit-collaboration`, `realms.rules-and-moderation` |
| Pagination                                                                                           | `pagination.numbered-navigation-decision` and cursor behavior inside the owning list outcomes                             |
| Mainland China edge                                                                                  | `release.china-edge-path`                                                                                                 |
| CI and release tasks                                                                                 | the `release.*` and `operations.*` outcomes                                                                               |
| SEO                                                                                                  | the existing SEO capability chain                                                                                         |
| About                                                                                                | `experience.about-and-policy-site`                                                                                        |
| Database review                                                                                      | `data.migration-integrity`; the obsolete checkout snapshot is not a compatibility target                                  |
| Internationalization, language design, and universal content                                         | `localization.application-and-content`, `content.capability-languages`, `discussions.threaded-replies`                    |
| Cover and image assets                                                                               | `media.asset-lifecycle`                                                                                                   |
| Desktop and `.rezics` configuration                                                                  | `desktop.local-first-authoring`                                                                                           |
| Decentralization and subsite modes                                                                   | `federation.realm-subsites`                                                                                               |
| Memorial community                                                                                   | `zones.memorial-community-template`                                                                                       |
| UI package                                                                                           | `experience.shared-design-system`, `developer.public-ui-package`                                                          |
| Editor experience                                                                                    | `editor.portable-text-authoring`, `catalog.subject-associations`, `search.advanced-builder`                               |
| Studio tool                                                                                          | `studio.creator-insights`                                                                                                 |
| Post and comment schemas                                                                             | `posts.core-publishing`, `discussions.threaded-replies`                                                                   |
| Shelf                                                                                                | Superseded by `collections.organize-units`; the old name is not a compatibility alias.                                    |
| Instant messaging Unit                                                                               | `messaging.direct-conversations`, `messaging.group-conversations`                                                         |
| Tag contribution rewards                                                                             | `tags.contribution-reputation`                                                                                            |
| History visibility                                                                                   | `history.published-revisions`, `history.revision-discussions`                                                             |
| API key, OAuth, and MCP access                                                                       | `developer.api-access`, `auth.third-party-oauth`                                                                          |
| Dispatch v1                                                                                          | `automation.dispatch-hub`                                                                                                 |
| Unit variants and library kinds                                                                      | `catalog.main-and-variants`, `catalog.books`, `catalog.media`, `catalog.software`, `catalog.series-and-releases`          |
| Plugin and notebook indexes                                                                          | Excluded: they contain implementation/reference links but no approved observable Rezics outcome.                          |
| Empty indexes, dated task lists, external research, code-analysis snapshots, and abandoned documents | Context only; no executable outcome remains.                                                                              |

## Graph completeness

```progress
id: tooling.progress-capability-coverage
status: done
goal: Keep every current first-class repository capability and active Outline product outcome connected to one owned Progress graph.
depends:
  - tooling.progress-protocol
accept:
  - Every web feature, main API route group, main service, workspace library or package, deployable application, and delivery owner maps to at least one outcome Item.
  - Every active Outline product topic maps to an Item or has a documented reason for exclusion.
  - Each Item has one stable owner, observable acceptance, executable or manual verification, and only real completion dependencies.
verify:
  - Compare the repository coverage tables with the current first-level owner directories under `apps/web/features`, `services/main/src/services/api`, `services/main/src/services`, `libraries`, `packages`, `deploy`, and `.github/workflows`.
  - Compare Outline collection trees with the reconciliation table, inspect every exclusion, and run `task progress:check`.
```

## V1 release result

```progress
id: release.v1-product-experience
status: open
goal: Release the first supported Rezics product as one complete, lawful, operable experience.
depends:
  - platform.v1-foundation
  - catalog.v1-experience
  - publishing.v1-experience
  - community.v1-experience
  - discovery.v1-experience
  - operations.v1-delivery
  - experience.about-and-policy-site
  - experience.installable-pwa
  - governance.repository-license
  - privacy.publish-policy
accept:
  - Visitors, account holders, contributors, community moderators, platform operators, API clients, and crawlers can complete every supported v1 journey under the same contracts.
  - Product, legal, privacy, security, accessibility, localization, data, release, observability, and recovery gates are approved and true in production.
  - No production journey depends on fixture-only data, an undocumented manual mutation, a pre-v1 compatibility path, or an unverified external assumption.
verify:
  - Run every milestone verification and the repository release checks against the exact release candidate.
  - Complete role-based, multilingual, accessibility, security, deployment, rollback, backup, restore, policy, and public-indexing acceptance before tagging v1.
```
