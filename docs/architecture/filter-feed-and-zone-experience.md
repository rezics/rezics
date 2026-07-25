# Filter, Feed, Search, and Zone experience

Status: Accepted

Owner: Domain

## Decision

Rezics uses `@rezics/filter` as the public, engine-independent predicate
contract over Units. A Filter is a bounded tree with `all`, `any`, and `not`
composition. Its typed relation predicates describe domain concepts such as
localizations, Realm placement, Tag assertions and their authority, Scores,
and Posts. It does not expose database table names, search-index field names,
or an engine query language.

Feed accepts this Filter through `POST /feed/query`. The standard Feed UI emits
only content-kind, language, Realm, and Tag predicates. Content-kind selection
is a Feed-owned projection over supported Unit and Post kinds; an empty
selection omits that predicate and means the default Feed universe. The backend
contract retains the complete domain capability, including Score predicates.
Product-specific flows such as Review lists may compose stricter Filters without
introducing a Review-only filtering language. Feed sorts are recommendation
objectives (`best`, `hot`, `new`, `top`, and `rising`); Feed never exposes
relevance.

Search is a feature that combines:

- optional full-text query input;
- a trusted SearchDocument;
- user-facing controls, facets, and Search-only relevance sorting;
- an optional domain Filter for fixed scope;
- an internal adapter to the current search index.

Full-text query text is request state. It is never stored as initial text in a
SearchDocument, because stored query copy would bypass the localization
ownership model. Search-index expressions remain internal implementation
details and are not a public Filter schema.

Zone boundaries use an optional domain Filter plus Search categories. A Feed
Block does not store a custom Filter. The standard Zone Feed Block uses the
Zone Search Feature, while advanced Search remains a separate, subdued link or
screen owned by the Search feature.

## Required Zone experience

Every live Zone must have:

1. an enabled Search Feature with a valid SearchDocument; and
2. at least one Zone Page containing a Feed Block and placed in the Zone's
   page structure.

Zone creation provisions both requirements in the same database transaction as
the Zone. The default page is published, addressed as `home`, placed in the
Zone page structure, and owned by the Zone creator. The default SearchDocument
uses the global template.

Bootstrap reconciles this invariant for every Zone, not only official Zones.
Readiness fails when any live Zone lacks either capability. Updating or deleting
Zone Pages may not remove the final Feed Block, and the Zone Search API does not
permit disabling Search.

Official Bootstrap data includes Book, Media, Software, Realm, and Zone library
Zones. Each has its own kind boundary, default Search template, Feed home page,
and deterministic Bootstrap identity.

## Validation and execution

The Filter schema is closed and runtime-validated at every untrusted JSON
boundary. Depth, node count, set uniqueness, UUIDs, enum values, and numeric
ranges are bounded. Feed cursors include a cryptographic hash of canonical
Filter JSON so a cursor cannot be reused with a different Filter.

Feed compiles Filter predicates to parameterized SQL. Search compiles only the
subset represented by the current index and fails closed for unsupported
predicates; it never silently broadens results. Viewer-relative predicates,
including private Tags and viewer-authored Scores, require an authenticated
Profile and evaluate to no match when one is unavailable.

## Rationale

This keeps one stable domain abstraction while allowing each execution engine
to optimize independently. It also separates backend capability from frontend
complexity: the API remains expressive, while the default Feed interaction
stays intentionally small.
