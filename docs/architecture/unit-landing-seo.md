# Unit landing SEO

Status: Implemented (v1)

Owners: Main Service and Web

## Scope

This first release provides server-rendered metadata and structured data for every publicly
addressable Unit landing kind:

`profile`, `book`, `software`, `media`, `video`, `audio`, `entity`, `tag`, `structure`, `series`,
`zone`, `zone_page`, `collection`, `post`, `poll`, and `realm`.

It deliberately does not add a sitemap, discovery feed, crawler queue, or corpus-wide SEO
projection. The optional `?language` parameter selects presentation only and is excluded from the
canonical URL.

## Indexing policy

| State | Metadata | Structured data | Robots |
| --- | --- | --- | --- |
| Public, approved, published General or R15 Unit with a title | Localized authored projection | Emitted | `index, follow` |
| Unlisted General or R15 Unit with a title | Localized authored projection | Omitted | `noindex` |
| R18 or R18G Unit | Generic restricted copy only | Omitted | `noindex, noarchive, noimageindex, nosnippet` |
| Private, draft, archived, removed, deleted, unsupported, missing, or failed projection | Generic unavailable copy only | Omitted | `noindex, noarchive, noimageindex, nosnippet` |

The Main Service checks classification before reading localization, artwork, description, or
context. Adult-authored fields therefore cannot cross the SEO response boundary. The Web layer
also models adult responses as `presentation: null`, so it cannot accidentally construct social
cards or JSON-LD from those fields.

## Canonical addresses

Unit IDs remain immutable identities. Canonical addresses follow
[Unit slug addressing](./unit-slug-addressing.md): Profile, Realm, Zone, and Zone Page prefer their
current canonical slug address and otherwise use their long ID route. Other enabled landing kinds
use their existing ID-addressed route. Former slugs redirect before metadata is constructed.

Zone Page `home` canonicalizes to the owning Zone root. Another addressed Zone Page uses its
Zone-scoped slug; an unaddressed Page uses `/zone/{zoneId}/page/{pageId}`. A Zone Page breadcrumb
includes its owning Zone when that parent canonical path is available.

## Projection contract

`GET /api/v1/units/by-id/{unitId}/seo` is a read-only, sanitized public projection. A successful
response contains immutable identity, kind, classification, publication timestamps, indexing
decision, and either:

- a bounded localized presentation for General/R15 content; or
- `presentation: null` for adult or incomplete content.

The Web adapter verifies that the returned Unit ID and kind match the route before using any
presentation. Backend failure, an invalid response, or an identity mismatch fails closed to the
generic unavailable `noindex` document. Metadata includes a canonical link, localized title and
description, Open Graph and Twitter fields, and robots directives. Indexable pages additionally
emit a Schema.org graph containing a WebPage or CollectionPage, breadcrumbs, and an applicable
main entity.

## Workload and capacity

The sizing baseline is 500,000,000 Units and the planning estimate is 3,000,000,000 Units. The SEO
request path does no corpus scan, count, deep offset, recursive lookup, or unbounded fan-out.

Per cold request, the maximum database work is:

1. one `unit.id` primary-key lookup;
2. at most seven `unit_localization` candidates, bounded by the complete ContentLanguage contract,
   using the `(unit_id, position, language)` index; and
3. at most one kind-specific context row, using the Entity or Zone Page primary key, or
   `credit_attribution_source_position_idx` for a Post.

Canonical slug resolution is also bounded: target-to-canonical lookup uses
`unit_slug_address_target_canonical_key`. The dedicated Zone Page address projections use the
`zone_page` primary key for ID routes and the unique `(scope_unit_id, slug)` address constraint for
slug routes; a retained redirect adds one canonical-target lookup. They do not require the owning
Zone to have a short address, so `/zone/{zoneId}/{pageSlug}` remains valid without falling back to
listing every Page in the Zone. The asymptotic request cost is indexed point/range lookup plus a
constant fan-out of seven, so corpus growth from 500 million to 3 billion rows does not increase
rows returned or application memory. The requested language list does not enlarge that bound.

The response performs no writes, adds no database objects, and causes no write amplification,
queue growth, migration cost, or maintenance scan. Description extraction touches only the chosen
localization row and truncates its normalized result to 600 characters before crossing the service
boundary. Web rendering memoizes duplicate work within one React server request but intentionally
uses `cache: no-store` across requests, avoiding stale classification after moderation changes.

Latency is therefore dominated by a small fixed number of indexed database round trips and image
URL presentation. Expected skew follows ordinary Unit page popularity; there is no global hot key.
Database connection-pool admission is the existing backpressure boundary. If traffic later exceeds
a single database partition, Unit-ID-derived sharding keeps the Unit and localization reads local;
the optional context lookup can be separately cached or colocated without changing this public
contract. No sitemap-scale batch or whole-corpus cache is required by this release.
