# Filter, Feed, Search, and Zone experience

Status: Accepted

Owner: Domain

## Decision

Rezics uses `@rezics/filter` as the only public, engine-independent Unit
selection contract. `UnitPredicate` is a bounded domain tree with `all`, `any`,
and `not` composition. `UnitFilter` adds an optional positive `SearchMatch`
alongside an optional `where: UnitPredicate`. Search is deliberately outside
the recursive predicate: cross-engine `OR`, `NOT Search`, and multi-query score
aggregation are not valid public states.

Typed predicates describe domain concepts such as localizations, Realm
placement, Tag assertions and their authority, Scores, and Posts. Neither
contract exposes database table names, search-index field names, or an engine
query language.

Feed accepts this Filter through `POST /feed/query`. The standard Feed UI emits
only content-kind, language, Realm, and Tag predicates. Content-kind selection
is a Feed-owned projection over supported Unit and Post kinds; an empty
selection omits that predicate and means the default Feed universe. The backend
contract retains the complete domain capability, including Score predicates.
Product-specific flows such as Review lists may compose stricter Filters without
introducing a Review-only filtering language. Feed sorts are recommendation
objectives (`best`, `hot`, `new`, `top`, and `rising`); Feed never exposes
relevance.

Language selection has two independent inputs. `localizationLanguages` is the
ordered presentation preference and may fall back through the Unit's own
localization order. A positive language predicate in the list Filter is an
eligibility and presentation boundary. For available Unit languages `A`,
ordered preferences `P`, and a selected language set `F`:

- automatic presentation chooses the first member of `P ∩ A`, then the first
  member of `A` in Unit order;
- filtered presentation chooses the first member of `P ∩ F ∩ A`, then the
  first member of `F ∩ A` in Unit order;
- filtered presentation never hydrates the item or its localized media from a
  language outside `F`.

The Feed keeps one result per Unit; selecting multiple languages never creates
one card per localization. Each canonical Feed item returns its actual
`language` and its ordered `availableLanguages`. Search Feature Feed applies
the same boundary when its positive expression proves that every matching
branch is language-constrained. Negative language predicates or an
unconstrained `any` branch remain eligibility-only because they cannot define a
safe positive display set.

Search is a presentation and execution feature over the same `UnitFilter`. It
combines:

- optional `UnitFilter.search` input executed by the Search Service;
- a trusted SearchDocument;
- user-facing controls, facets, and Search-only relevance sorting;
- `UnitFilter.where` plus trusted domain predicates for fixed scope;
- an internal adapter to the current search index.

SearchDocument controls emit bounded `SearchControlPredicate` values. Those
values are trusted-control state, not another general Unit Filter: only the
Search Feature accepts them, and the server resolves them to a private
Search-Service expression after checking the selected control and template.

SearchDocument owns separate Search and Feed sort profiles. Each profile
selects an ordered subset of server-owned strategies and declares defaults for
empty and non-empty text queries. Search defaults to `best` without text and
`relevance` with text. Feed defaults to `best` in both states and may never
include `relevance`, even when its Filter contains a Search match. `best` is a
recommendation order; `relevance` is text-query ranking and is invalid without
a non-empty query. A document may select strategies but cannot define raw
index fields or engine ranking expressions.

The current Search projection implements `best` as descending global
`recommendationBest`, then descending update time, then ascending Unit ID for
a stable tie-break. `recommendationBest` is the active recommendation
snapshot's positive weighted engagement accumulated over the previous 24
hours, with a missing score represented as zero. This order is not
viewer-personalized.

Execution surface and result presentation are independent contracts. A Search
surface may hydrate its mixed results into canonical Feed items without
acquiring Feed sorting semantics, while a Feed surface may reuse the same
filter editor without acquiring Search relevance. Every shared presentation
adapter must receive the execution surface explicitly; visual appearance must
never select a sort profile.

“Search Feed” names that presentation adapter: Search Feature executes a
`UnitFilter` with the `feed` sort profile and hydrates the selected Units into
canonical Feed items. It is not a second Feed product, a second filtering
schema, or a text-only execution path. In particular:

| Product surface     | Selection state                           | Execution profile   | Result presentation |
| ------------------- | ----------------------------------------- | ------------------- | ------------------- |
| Standard Feed       | `UnitFilter`                              | Feed recommendation | Feed items          |
| Search results      | `UnitFilter` plus trusted Search controls | Search              | Grouped Search hits |
| Search Feature Feed | `UnitFilter` plus trusted Search controls | Feed                | Feed items          |

The text box on every row in this table writes `UnitFilter.search`; it never
writes a sibling “search feed” request. A Search Feature presentation may
inject fixed, non-removable Search controls. Independently, a product-owned
canonical Feed list may compose an additional `UnitPredicate` into
`UnitFilter.where`. The Review list uses the latter path: it fixes content-kind
and subject predicates, while its scoring-Realm selector composes a
displayed-Score predicate. When that Feed also has query text, its execution
adapter maps the fixed content kind to an internal Search category without
changing the public Filter. Language, Realm placement, Tags, query text, and
other user-controlled conditions remain SearchDocument controls or
`UnitFilter` state and are passed unchanged when navigating between compact and
full-page presentations.

Full-text query text remains request state inside the Filter. It is never
stored as initial text in a SearchDocument, because stored query copy would
bypass the localization ownership model. Search-index expressions, cursor
encoding, and engine compilation are server-internal implementation details,
not another public Filter schema.

Zone boundaries use an optional `UnitPredicate` plus Search categories. A Feed
Block does not store a custom Filter. The standard Zone Feed Block uses the
Zone Search Feature. Its content-type selector emits a `UnitPredicate` and is
rendered in the same Filter toolbar as sort and the remaining Filter controls.
The shared toolbar keeps its product-wide order fixed as sort, schema-selected
quick filters, then the remaining Filter action. Schema controls capabilities,
option order, and defaults; it does not duplicate this invariant layout in
every document.
The frontend-only Advanced Search builder exposes the trusted `kind` control
under the user-facing “Content type” label and emits the same
`SearchControlExpression` contract as quick filters.

## Required Zone experience

Every live Zone must have:

1. an enabled Search Feature with a valid SearchDocument; and
2. at least one Zone Page containing a Feed Block and placed in the Zone's
   page structure.

Zone creation provisions both requirements in the same database transaction as
the Zone. The default page is published, addressed as `home`, placed in the
Zone page structure, and owned by the Zone creator. The Search template is an
explicit bootstrap input. Ordinary Zones use `global`; official work Zones
use their Book, Media, or Software template from their bootstrap manifest.

Bootstrap reconciles this invariant for every Zone, not only official Zones.
Readiness fails when any live Zone lacks either capability. Updating or deleting
Zone Pages may not remove the final Feed Block, and the Zone Search API does not
permit disabling Search.

Official Bootstrap data includes Book, Media, Software, Realm, and Zone
workspaces. Each has its own kind boundary, default Search template, Feed home page,
and deterministic Bootstrap identity.

## Validation and execution

The Filter schema is closed and runtime-validated at every untrusted JSON
boundary. Depth, node count, set uniqueness, UUIDs, enum values, and numeric
ranges are bounded. Feed cursors include a cryptographic hash of canonical
Filter JSON and bind both the selected and preferred language sequences, so a
cursor cannot be reused with a different Filter or presentation decision.
Search cursor request hashes likewise bind the ordered presentation languages;
changing preferences or an explicit language override starts a new result
window.

Feed compiles `UnitPredicate` to parameterized SQL. When `UnitFilter.search` is
present, the Search Service supplies matching candidate identities and applies
query ranking only when the selected Search profile requests it. The
authoritative domain predicate is still composed separately. Engine
pushdown fails closed for unsupported predicates; it never silently broadens
results. Viewer-relative predicates,
including private Tags and viewer-authored Scores, require an authenticated
Profile and evaluate to no match when one is unavailable.

Meilisearch treats an explicit ordering strategy as authoritative. `relevance`
therefore emits no explicit sort, while `best` and field orders emit a sort
whose ranking rule precedes text-ranking rules. Text may still select the
candidate set for a Feed, but it cannot silently turn that Feed into a
relevance-ranked Search result.

For `relevance`, matching relaxes frequent query words before distinctive
words. The remaining candidates follow the engine's words, typo, proximity,
searchable-attribute, and exactness rules. Every localized title occupies the
highest searchable-attribute tier; the Unit's display fallback order does not
make one language more relevant than another. Composed fallback-path titles,
aliases, summaries, descriptions, and published content follow in that order.
Recommendation score, recent update time, and Unit ID act only as deterministic
tie-breaks after text relevance.

Search-backed Feed responses preserve total-count exactness. A response may
report an exact total or a lower bound when the Search Service has not exhausted
its bounded candidate window. Clients must render that distinction (for
example, “at least 1,000”) and must not present a lower bound as an exact count.

## Rationale

This keeps one stable domain abstraction while allowing each execution engine
to optimize independently. It also separates backend capability from frontend
complexity: the API remains expressive, while the default Feed interaction
stays intentionally small.
