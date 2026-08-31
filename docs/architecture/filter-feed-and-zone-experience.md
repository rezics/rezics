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
localization order. An omitted or empty preference sequence means that the
consumer supplies no presentation hint, so fallback starts with the Unit's
stored localization order. A positive language predicate in the list Filter
is an eligibility and presentation boundary. For available Unit languages
`A`, ordered preferences `P`, and a selected language set `F`:

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
- a sparse, trusted `FilterDocument` whose omitted members add no condition;
- user-facing controls, facets, and Search-only relevance sorting;
- `UnitFilter.where` plus trusted domain predicates for fixed scope;
- an internal adapter to the current search index.

Resolved Filter controls emit bounded `SearchControlPredicate` values. Those
values are trusted-control state, not another general Unit Filter: only the
Search Feature accepts them, and the server resolves them to a private
Search-Service expression after checking the selected control against the one
global field registry. A Filter document may narrow categories, add a fixed
predicate, or sparsely override controls. It cannot add fields, operators,
sorts, facets, page sizes, result windows, or engine ranking expressions.

The server owns separate Search and Feed sort policies. Search defaults to
`best` without text and `relevance` with text. Feed defaults to `best` in both
states and may never include `relevance`, even when its Filter contains a
Search match. `best` is a recommendation order; `relevance` is text-query
ranking and is invalid without a non-empty query. An endpoint such as Progress
may narrow the global policy for its data source, but that executable policy is
not a persisted document or preset.

The current authoritative PostgreSQL Search query implements `best` as descending global
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
other user-controlled conditions remain resolved Filter controls or
`UnitFilter` state and are passed unchanged when navigating between compact and
full-page presentations.

Full-text query text remains request state inside the Filter. It is never
stored in a `FilterDocument`, because stored query copy would bypass the
localization ownership model. Search-index expressions, cursor encoding, and
engine compilation are server-internal implementation details, not another
public Filter schema.

A Zone stores one sparse `FilterDocument` directly. A Search or Feed Block may
use the hosting Zone document, `{}` from the global source, or one inline sparse
document. The hosting Zone remains an enforced scope in every case. The
standard Zone Feed Block uses the Zone-owned document. Its content-type
selector emits a `UnitPredicate` and is rendered in the same Filter toolbar as
sort and the remaining Filter controls.

A Zone may also select one `local_rule_realm_id`. The referenced Realm remains
the owner of its immutable Rule revisions; the Zone is only a policy context
and never becomes a second Rule container. Zone-local governance may cite that
Realm and the official Rule Realm. A missing local source means official Rules
only. Platform-global actions on a Zone Unit still use official Rules because a
global Unit mutation cannot be scoped to one presentation context. Zone create
and update reject a selected Realm unless its Unit is non-deleted and its
current immutable revision has at least one Rule; decision creation revalidates
the source and revision under the shared Rule-publication lock.
The shared toolbar keeps its product-wide order fixed as sort, schema-selected
quick filters, then the remaining Filter action. Schema controls capabilities,
option order, and defaults; it does not duplicate this invariant layout in
every document.
The frontend-only Advanced Search builder exposes the trusted `kind` control
under the user-facing “Content type” label and emits the same
`SearchControlExpression` contract as quick filters.

## Required Zone experience

Every live Zone must have:

1. a valid, possibly empty `FilterDocument` on the Zone row; and
2. at least one Zone Page containing a Feed Block and placed in the Zone's
   page structure.

Zone creation provisions both requirements in the same database transaction.
The default page is published, addressed as `home`, placed in the Zone page
structure, and owned by the Zone creator. Omitting every Filter member stores
`{}`, which contributes no document-level condition.

Bootstrap reconciles this invariant for every Zone, not only official Zones.
Readiness fails when any live Zone lacks either requirement. Updating or
deleting Zone Pages may not remove the final Feed Block.

Official Bootstrap data includes Book, Media, Software, Realm, and Zone
workspaces. Book, Media, and Software are ordinary Zones, not Search capability
profiles. Each official workspace stores its concrete selection boundary as a
Filter document and has a Feed home page and deterministic Bootstrap identity.

## Validation and execution

The Filter schema is closed and runtime-validated at every untrusted JSON
boundary. Depth, node count, set uniqueness, UUIDs, enum values, and numeric
ranges are bounded. Feed cursors include a cryptographic hash of canonical
Filter JSON and bind both the selected and preferred language sequences, so a
cursor cannot be reused with a different Filter or presentation decision.
Search cursor request hashes likewise bind the ordered presentation languages;
changing preferences or an explicit language override starts a new result
window.

Feed compiles `UnitPredicate` to parameterized SQL. When `UnitFilter.search` is present, the
Search Service compiles text and authoritative domain predicates into bounded PostgreSQL SQL and
applies ranking only when the selected Search profile requests it. Compilation fails closed for
unsupported predicates; it never silently broadens results. Viewer-relative predicates,
including private Tags and viewer-authored Scores, require an authenticated
Profile and evaluate to no match when one is unavailable.

PGroonga supplies text relevance only for the `relevance` profile. `best` and field orders remain
explicit PostgreSQL sorts, so text matching cannot silently turn a Feed into a relevance-ranked
Search result.

A Search Feature Feed executes all selected categories as one globally ordered result stream.
Category is a filtering dimension, not a balancing rule: results are never round-robin interleaved
after ranking. Its opaque keyset cursor binds the request hash, stable sort values, and Unit ID so
page boundaries cannot reorder results.

For `relevance`, matching relaxes frequent query words before distinctive words. Every localized
title occupies the highest search tier; the Unit's display fallback order does not make one
language more relevant than another. Summaries, semantic descriptions, and published content
follow in that order.
Recommendation score, recent update time, and Unit ID act only as deterministic
tie-breaks after text relevance.

Search-backed Feed responses preserve total-count exactness. A response may
report an exact total or a lower bound when the Search Service has not exhausted
its bounded candidate window. Clients must render that distinction (for
example, “at least 1,000”) and must not present a lower bound as an exact count.

## Feed projection and payload budget

Canonical Feed items are discovery projections, not Post detail resources.
Post items therefore return authored `title` and optional authored `summary`,
but never the Portable Text `body`. A consumer that opens or otherwise needs a
Post body reads `GET /api/v1/posts/:postId`. Missing summary is represented by
`null`; the server and clients do not manufacture an excerpt from the body.

Every Feed request returns at most 50 items. Zone query Blocks use at most 20
eager items, with at most 24 Page query Blocks and 6 Dock query Blocks. Each
item carries at most 8 attribution summaries and 8 public Realm contexts. The
hydration query applies those per-item association limits inside PostgreSQL
with index-routed lateral probes; it does not fetch all associations and slice
them in application memory. The selected execution Realm is ordered first when
it is public and present within the bound.

`unit_localization` and the association relations are planned at 500 million
rows and estimated at 3 billion rows. Candidate selection supplies at most 50
Unit IDs to hydration. Localization reads remain equality/index lookups, while
each attribution probe reads at most 8 entries from
`credit_attribution_source_position_idx` and each Realm-context probe reads at
most 8 entries from `realm_unit_unit_publication_status_updated_idx`. Work is
therefore proportional to the requested page and fixed per-item bounds rather
than corpus cardinality or a Unit's total association degree. These reads add
no writes, write amplification, background queue, cache invalidation, or
whole-corpus maintenance.

At the maximum Zone Page plus Dock shape, at most 600 item projections are
validated across independently bounded Block results. Authored summaries are
limited to 2,000 characters at write boundaries, so the summary contribution
is at most 1.2 million characters (up to 4.8 MB in worst-case UTF-8) before
ordinary response metadata. This is a defensive maximum, not a target response
size; normal Pages should remain well below it. Before this decision, Post
bodies made the same request unbounded by content size and multiplied database
I/O, heap retention, JSON serialization, schema validation, network transfer,
client parsing, and rendering work.

The srvx entry point compiles the complete Elysia application after conditional
routes are registered and before accepting traffic. Route validators therefore
pay their code-generation cost once during startup. Request-path validation
remains linear in the bounded response shape and does not use Elysia's deferred
interpreter path for the first requests.

The breaking 1.11.0 client cutover and rollback are specified in
[`docs/releases/1.11.0.md`](../releases/1.11.0.md).

## Rationale

This keeps one stable domain abstraction while allowing each execution engine
to optimize independently. It also separates backend capability from frontend
complexity: the API remains expressive, while the default Feed interaction
stays intentionally small.
