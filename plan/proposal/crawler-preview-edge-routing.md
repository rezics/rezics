---
title: Crawler preview edge routing
status: done
created: 2026-06-04
completed: 2026-06-06
supersededBy:
tags: [preview, edge, seo, cloudflare]
---

## Why

Rezics should keep `@rezics/app` as a static SPA on Cloudflare while serving
bot-friendly HTML, sitemap XML, and future SVG/OG preview assets through a
dedicated preview surface. Human traffic should receive the SPA and static
assets; verified crawlers and link unfurlers should be routed through an edge
entrypoint to `@rezics/preview`.

The first production shape is a hybrid: a small Cloudflare Worker package owns
edge routing, bot detection, cache policy, and fallback behavior, while
`@rezics/preview` remains a Bun/Elysia service that can use Drizzle/Postgres,
Meilisearch, and high-performance server-side templates. Do not extract
`preview-core` yet; wait until route metadata, canonical URL logic, or template
helpers are duplicated across `edge` and `preview`.

## Durable constraints & decisions

- `(type)` Add `@rezics/edge` as the Cloudflare Worker runtime package under
  `package/edge`; keep `@rezics/app` as a Vite SPA package and point the Worker
  static assets binding at the app build output.
- `(comment)` `@rezics/edge` is a router/proxy/cache layer only. It must not
  import Elysia, React, Drizzle, server services, or preview templates.
- `(type)` Edge configuration needs explicit environment bindings for
  `PREVIEW_BASE_URL`, optional `PREVIEW_INTERNAL_SECRET`, and the static asset
  binding. No private server/database secrets belong in the app build.
- `(test)` Edge bot routing must route only allowlisted SEO paths to preview;
  asset requests and non-allowlisted paths must remain on static asset or SPA
  fallback handling.
- `(test)` Bot detection must prefer Cloudflare-provided verified bot signals
  when available, then use a small user-agent fallback for social unfurlers and
  development/test coverage.
- `(test)` Preview proxy failures must have deterministic fallbacks: not-found
  item pages return bot-readable 404 HTML from preview, temporary preview-origin
  failures fall back through edge without converting human traffic into preview
  traffic, and sitemap failures prefer cached stale content when available.
- `(type)` `@rezics/preview` should use `@elysiajs/html` / Kita HTML JSX for
  HTML templates, not React SSR. Sitemap XML and SVG output need dedicated XML
  escaping helpers rather than raw HTML escaping.
- `(comment)` Do not introduce `preview-core` in this work. Extract it only when
  concrete duplication appears between edge and preview.
- `(test)` Data source boundaries must stay explicit: item/detail pages may read
  Postgres through Drizzle-backed read paths; search/list preview pages read
  Meilisearch; sitemap generation must use bounded cursor/page reads instead of
  loading the full catalog at once.
- `(comment)` Preview is read-only by contract. Deployment should use read-only
  database credentials where the infrastructure supports it, and preview routes
  must not expose mutation-capable service surfaces.
- `(test)` Cache headers must be route-specific: item HTML can use short
  `stale-while-revalidate`, sitemap XML can cache longer, and SVG/OG responses
  should use content-versioned cache keys when introduced.

## 1. Add the edge package

- [x] 1.1 Create `package/edge/package.json` with Worker build/deploy scripts
  and workspace dependencies limited to edge-safe packages.
- [x] 1.2 Add `package/edge/wrangler.jsonc` with `src/index.ts` as the Worker
  entrypoint and static assets configured from `package/app/dist`.
- [x] 1.3 Add `package/edge/src/index.ts` as the fetch handler that dispatches
  static assets, SPA fallback, and preview proxy requests.
- [x] 1.4 Add `package/edge/src/routes.ts` for the SEO preview allowlist,
  including detail routes, sitemap routes, robots, and future OG/SVG route
  prefixes.
- [x] 1.5 Add `package/edge/src/bot.ts` for verified bot detection plus the
  limited user-agent fallback.
- [x] 1.6 Add `package/edge/src/preview-proxy.ts` for origin fetch, internal
  secret header forwarding, preview response cache handling, and fallback
  response behavior.
- [x] 1.7 Add focused tests for `bot.ts`, `routes.ts`, and preview proxy
  fallback decisions.

## 2. Convert preview templates

- [x] 2.1 Update `package/preview/package.json` dependencies to add
  `@elysiajs/html` and remove React SSR dependencies once no template uses them.
- [x] 2.2 Update `package/preview/tsconfig.json` for the Kita HTML JSX runtime
  used by `@elysiajs/html`.
- [x] 2.3 Replace `package/preview/src/components/BookShareDocument.tsx` and
  React stream utilities with `package/preview/src/templates/book-detail.tsx`.
- [x] 2.4 Register the Elysia HTML plugin in `package/preview/src/index.ts` and
  return JSX/string template responses through the plugin.
- [x] 2.5 Keep preview route modules under existing domain folders such as
  `package/preview/src/book/`, but move reusable rendering helpers under
  `package/preview/src/templates/` and `package/preview/src/utils/`.
- [x] 2.6 Add tests for escaped titles, descriptions, canonical URLs, OG image
  URLs, and 404 HTML output.

## 3. Add sitemap and preview data boundaries

- [x] 3.1 Add `package/preview/src/sitemap/` routes for `sitemap.xml` and
  sitemap index/shard responses.
- [x] 3.2 Add `package/preview/src/utils/xml.ts` with XML/SVG escaping helpers
  and tests.
- [x] 3.3 Add bounded sitemap data queries using cursor/page inputs; avoid
  full-table catalog loads.
- [x] 3.4 Add or refactor preview read paths so item detail routes use
  Postgres/Drizzle-backed reads and list/search routes use Meilisearch.
- [x] 3.5 Add route-specific cache headers for book detail HTML, sitemap XML,
  robots, and future SVG/OG responses.

## 4. Deploy and document

- [x] 4.1 Add production build/deploy documentation for `@rezics/edge` after
  `@rezics/app` build and backend/preview service deployment.
- [x] 4.2 Add production runtime inventory updates that reclassify
  `@rezics/preview` from non-production tooling to a read-only preview HTTP
  service.
- [x] 4.3 Add preview deployment configuration or Docker/Kamal wiring matching
  existing backend service patterns.
- [x] 4.4 Add environment reference entries for preview and edge secrets,
  including `PREVIEW_BASE_URL`, `PREVIEW_INTERNAL_SECRET`, preview port, database
  read URL, and Meilisearch access.
- [x] 4.5 Add convention or test coverage that prevents `@rezics/edge` from
  importing backend-only packages.

## Out of scope

- Full SPA SSR or React hydration on crawler pages.
- Extracting `preview-core`.
- Moving preview rendering into Cloudflare Worker.
- Implementing final book SVG/OG image designs beyond reserving route/cache
  boundaries.
- Replacing the main app routing model or converting `@rezics/app` away from a
  static Vite SPA.
