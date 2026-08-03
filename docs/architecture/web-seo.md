# Web indexing and SEO

`apps/about` already owns a static sitemap, robots policy, canonical URLs,
language alternates, and structured data. The main `apps/web` application does
not yet have an equivalent indexing contract: it has shared root metadata, no
robots or sitemap metadata route, and public resource pages still obtain much
of their primary content in client-owned query boundaries.

Only a resource whose server path proves public visibility, publication state,
canonical address, and an actual `200` response may be indexed or included in
a sitemap. Search, filtered, authenticated, management, draft, unlisted,
private, deleted, and missing surfaces stay outside the index. App Router files
remain adapters; feature-owned server loaders must provide one result to
metadata, server rendering, structured data, and client hydration.

The product direction is recorded in the
[Rezics Outline SEO document](https://outline.rezics.com/doc/seo-HlH0iYoCuG).
The Items below retain only results with an observable repository contract.

```progress
id: seo.indexing-policy
status: open
goal: Establish one testable indexing, canonical, and crawler policy for the main web application.
depends: []
accept:
  - A feature-owned policy classifies every public and non-public route family as indexable, noindex, redirect, not found, or gone.
  - Production origin and canonical helpers follow the supported scoped-slug contract and remove tracking or context-only parameters.
  - Main-site robots metadata permits crawlers to read noindex pages and excludes only paths that should not be fetched.
  - Static canonical pages appear in a valid main-site sitemap and no unsupported or private route does.
verify:
  - Run `task apps-web:test`.
  - Run `task apps-web:typecheck`.
  - Inspect generated robots, canonical metadata, and static sitemap responses for representative allowed and denied routes.
```

```progress
id: seo.public-resource-ssr
status: open
goal: Server-render indexable Post and Unit pages with truthful metadata and HTTP status.
depends:
  - seo.indexing-policy
accept:
  - An anonymous first HTML response contains the unique title, description, canonical URL, heading, primary content, and crawlable internal links.
  - Metadata, page rendering, and client hydration share one feature-owned server result without duplicate API reads.
  - Private, unpublished, deleted, and missing resources cannot leak metadata or content and return the policy's status.
  - Old supported slugs redirect to the current canonical address.
verify:
  - Run the Post and Unit server-loader, metadata, status, and hydration contract tests.
  - Build `apps/web` and inspect anonymous HTTP responses with JavaScript disabled.
  - Confirm representative private, missing, old-slug, and canonical resources return the expected status and metadata.
```

```progress
id: seo.dynamic-sitemaps
status: open
goal: Publish bounded dynamic sitemaps containing only canonical public resources.
depends:
  - seo.public-resource-ssr
accept:
  - The main service exposes a keyset-paginated sitemap projection with resource kind, identity, canonical address facts, material update time, and indexability.
  - Sitemap indexes split resource families before protocol size or URL limits.
  - Entries use production absolute canonical URLs and material update times rather than request time.
  - Redirects, query variants, drafts, unlisted, private, deleted, missing, and non-SSR resource families are absent.
verify:
  - Run service projection contract tests and web sitemap response tests.
  - Validate generated sitemap indexes and shards with an independent XML parser.
  - Sample every included route family and confirm each URL returns canonical indexable content with status 200.
```

```progress
id: seo.structured-data-and-monitoring
status: open
goal: Add truthful structured data and production SEO monitoring after the crawl contract is stable.
depends:
  - seo.dynamic-sitemaps
accept:
  - JSON-LD types match visible page content and use typed Schema.org contracts.
  - Search Console and Bing Webmaster Tools verify the production origins and submitted sitemap indexes.
  - Scheduled crawl checks detect broken links, redirect chains, duplicate metadata, canonical errors, and sitemap drift.
  - Performance monitoring follows the approved privacy and data-minimization contract before collecting browser metrics.
verify:
  - Validate representative pages with Schema.org and search-engine structured-data tools.
  - Run the approved site crawler against a release candidate and review every error class.
  - Confirm search-platform ownership, sitemap ingestion, and privacy approval for any real-user metric collection.
```
