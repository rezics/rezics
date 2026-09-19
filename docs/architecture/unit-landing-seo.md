# Resource landing SEO

Status: v1 SEO exists; the 2026-09-19 Resource/Space/address revision below is a
selected target requiring consumer qualification. The historical filename remains
for document navigation. Owners: Main Service and Web.

## Scope

Provide a sanitized metadata/structured-data projection for an authorized resolved
Resource view. A Space route targets the same Resource as an ID lookup and uses the
shared renderer. Removing native ZonePage does not prohibit emitting a WebPage
description for an actual rendered web representation.

This target does not activate a sitemap, crawler or corpus-wide SEO projection.
It follows [modeling](schema-modeling.md), [addressing](unit-slug-addressing.md) and
the selected content/publication contracts. Vocabulary preservation and full source
interoperability are independently qualified.

## Indexing policy

| State | Metadata | Structured data | Robots |
| --- | --- | --- | --- |
| Public, approved, published General or R15 Resource with usable presentation | Authorized localized projection | Emitted under an elected profile | `index, follow` |
| Unlisted General or R15 Resource | Authorized localized projection | Omitted | `noindex` |
| R18 or R18G Resource | Generic restricted copy only | Omitted | `noindex, noarchive, nosnippet` |
| Private, draft, archived, removed, deleted, unsupported, missing or failed projection | Generic unavailable copy only | Omitted | `noindex, noarchive, nosnippet` |

Check current disclosure and content-rating policy before loading or exposing
titles, bodies, artwork, canonical locations or context. Neither a public Space
mount nor stale search/address data can disclose a restricted target. Preserve
`presentation: null` for unavailable/restricted projections and fail closed on
invalid identity, route or representation bindings.

## Canonical addresses

Canonical selection consumes AddressPreference with explicit site/Space/purpose
context. The same Resource may have a preferred address in several Spaces. Do not
read a target-wide canonical slug or reconstruct a Page-owned URL. A route's
operational ID is not content identity, and `/` is an explicit root binding.

The SEO profile elects the preferred web representation for the requested scope;
aliases resolve before metadata emission. Redirects recheck current visibility
and preserve permitted parameters/fragments. A fixed Pro site's conjunction cannot
be bypassed by redirecting to a general address for the same Resource.

Resource identity is independent of presentation language. The route/SEO profile
declares which language/format parameters participate in its canonical address;
the v1 convention of omitting `language` is not a universal identity rule. Report
actual selected language and fallback. Multilingual variants use the open language
contract, not a seven-language lifetime limit. Available alternate-address metadata
is bounded and policy-aware.

## Projection contract

The existing `GET /api/v1/units/by-id/{unitId}/seo` is a current implementation entry
point, not proof of scoped address support. Target reads supply ResourceRef and
optional resolved address context; they return identity, exact relevant selection,
address preference/generations, indexing decision and a bounded safe presentation
or explicit unavailability. Update service, generated clients and Web adapters
together when activated. Do not publish an invented new wire path in the meantime.

The Web adapter checks target and resolved context before composing metadata.
Schema.org output is a declared projection of accepted native data; simplified
output records unsupported/lost semantics through its export profile. It cannot
claim full source import or lossless preservation of qualified relationships.

## Workload and capacity

Retain the [500M/3B planning policy](data-integrity-and-workload-budgets.md#capacity-planning).
A request resolves a bounded address path and target, selects an admitted number
of language candidates, batch-hydrates necessary presentation dependencies and
returns bounded metadata. Indexes follow logical identity, namespace/key and
resource/context preference. No request scans all languages, aliases, routes,
owner tables or the corpus.

The former v1 explanation using one global `unit` row, at most seven localization
rows and a `zone_page` primary key does not qualify the selected owner-local,
open-language, multi-Space target. Measure query plans, skew, bytes, cache policy
and invalidation before publishing replacement latency/capacity evidence. Address,
content and moderation changes invalidate relevant projections; cache keys bind
the effective representation/context and never substitute for current disclosure.

## Required verification

Use [model-contract acceptance](../testing/model-contracts.md) for multiple Space
addresses, exact target/representation agreement, Unicode/UUID lookup, reverse-link
and stale-generation behavior, aliases/tombstones, unavailable translations and
revocation before metadata/redirect delivery. Existing v1 acceptance remains limited
to its recorded contracts; target checks are not yet executed.
