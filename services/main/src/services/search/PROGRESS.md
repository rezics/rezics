# Discovery Progress

This document owns query, filter, search, metrics, home discovery, pagination,
and indexing outcomes. PostgreSQL remains canonical; Meilisearch and any
aggregate are rebuildable projections with explicit generation and freshness.

Planning context:

- [Outline: search](https://outline.rezics.com/doc/search-vKY4mI9VfR)
- [Outline: content feed](https://outline.rezics.com/doc/content-feed-idj9eU2asb)
- [Outline: pagination](https://outline.rezics.com/doc/5yig6acb57o757wx-mnHd5ewoZa)
- [Outline: SEO](https://outline.rezics.com/doc/seo-HlH0iYoCuG)

The detailed Filter, Feed, Search, and Zone rules remain in
`docs/architecture/filter-feed-and-zone-experience.md`; the search service
contract remains in `services/main/src/services/search/README.md`.

## Filter and Search

```progress
id: filter.shared-query-contract
status: open
goal: Give Feed, Search, Zone, and dynamic collections one versioned, bounded Filter document contract.
depends:
  - catalog.unit-lifecycle
accept:
  - Content kind, status, visibility, language, Realm, tag, relationship, subject, rating, date, and product-specific predicates have one typed meaning.
  - Structural validation, normalization, execution, serialization, URLs, saved documents, and option discovery preserve that meaning.
  - Unsupported fields, excessive depth or breadth, inaccessible references, and expensive combinations fail with actionable bounded errors.
verify:
  - Run the filter library, API Filter schema, SQL compiler, search compiler, feed query, URL parser, and Zone validation tests.
  - Execute a shared corpus of valid, invalid, equivalent, inaccessible, and complexity-limit Filters through PostgreSQL and Search.
```

```progress
id: search.live-discovery
status: open
goal: Let people search readable Units and Posts with localized ranking, stable continuation, facets, and truthful freshness.
depends:
  - catalog.v1-experience
  - posts.core-publishing
  - filter.shared-query-contract
accept:
  - Canonical projection sources, document schemas, localization, visibility, history, and field registry cover every searchable v1 kind.
  - Index generations can prepare, backfill, reconcile, promote, roll back, and rebuild without mixing schemas or losing writes.
  - Query, ranking, highlighting, facets, continuation, shared query links, empty state, degraded state, and stale-index disclosure use live contracts.
verify:
  - Run search projection, field-registry, generation, Meilisearch, query, service, API, shared-query, and web search tests.
  - Execute the search generation contract and query multilingual, private, deleted, updated, and newly published content before and after promotion.
```

```progress
id: search.advanced-builder
status: open
goal: Let people move between simple and advanced search without changing or losing the underlying Filter meaning.
depends:
  - search.live-discovery
accept:
  - Simple search exposes the common safe controls and advanced search can express every supported Filter operation.
  - Injected scope, hidden controls, locked predicates, editable predicates, URL state, shared links, and round trips preserve intent.
  - Invalid, unavailable, unauthorized, contradictory, and overly complex criteria identify the exact correction required.
verify:
  - Run search builder model, entity picker, Filter round-trip, URL, shared-query, scoped-search, and accessibility tests.
  - Have a maintainer accept simple, advanced, injected-scope, shared-link, invalid, and recovery journeys.
```

## Metrics, home, and pagination

```progress
id: analytics.localized-content-metrics
status: open
goal: Compute bounded, rebuildable content metrics that preserve the language and document version they describe.
depends:
  - posts.core-publishing
  - content-structure.book-and-media
accept:
  - Character, word, block, media, duration, and completion-relevant measures declare algorithm, unit, locale assumptions, and source revision.
  - Metrics update transactionally or through an observable idempotent projection and can be rebuilt from canonical content.
  - Product surfaces never present a metric for the wrong language, revision, content kind, or unavailable source.
verify:
  - Run portable-text metric, content-metric service, localization, projection, rebuild, and presentation tests.
  - Compare metrics for representative Latin, CJK, mixed, media, empty, revised, and removed content.
```

```progress
id: discovery.home-experience
status: open
goal: Give visitors and signed-in people a useful home discovery experience with explicit fallback and personalization.
depends:
  - feed.composable-content-list
  - recommendations.personalized
accept:
  - Visitors receive a curated public discovery feed and signed-in people receive an explainable personalized or following-aware feed.
  - Content, language, Realm, tag, and sort controls are reflected in the URL and share the Feed contract.
  - Cold start, no results, missing personalization, worker lag, service degradation, and recovery have localized states.
verify:
  - Run home, feed query, recommendation, filter routing, continuation, error, and empty-state tests.
  - Have a maintainer accept visitor, new-account, established-account, filtered, empty, degraded, and recovery journeys.
```

Numbered navigation remains a separate decision in
`pagination.numbered-navigation-decision`; cursor continuation is required
independently for unbounded feeds and search.

## Public indexing

The indexing chain is deliberately split into the existing
`seo.indexing-policy`, `seo.public-resource-ssr`, `seo.dynamic-sitemaps`, and
`seo.structured-data-and-monitoring` Items in
`docs/architecture/web-seo.md`.

## Discovery milestone

```progress
id: discovery.v1-experience
status: open
goal: Make public and signed-in v1 discovery complete across filters, search, feeds, home, URLs, and web indexing.
depends:
  - filter.shared-query-contract
  - search.live-discovery
  - search.advanced-builder
  - analytics.localized-content-metrics
  - discovery.home-experience
  - pagination.numbered-navigation-decision
  - seo.indexing-policy
  - seo.public-resource-ssr
  - seo.dynamic-sitemaps
  - seo.structured-data-and-monitoring
accept:
  - People and crawlers can find the same eligible public resources through truthful localized routes and bounded query contracts.
  - Signed-in personalization and private content never leak into public results, shared links, sitemaps, metadata, or caches.
  - Search, feed, indexing, projection, and degradation behavior remain observable and recoverable.
verify:
  - Run filter, search, feed, recommendation, route, SSR, sitemap, structured-data, and production build checks.
  - Execute the discovery acceptance matrix for visitor, crawler, signed-in, private, multilingual, stale-index, and degraded cases.
```
