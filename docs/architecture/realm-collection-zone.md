# Space, Realm, Collection and Zone composition

Status: shared Space identity and Resource-targeting routes selected on 2026-09-19;
implementation and acceptance remain pending. This is the semantic owner for grouping
and subsite composition. The [implementation plan](../plan/README.md) owns activation
and progress. Existing Realm/Zone/Page tables are not evidence that this target is
implemented. Resource is the [selected name of the logical Unit contract](schema-modeling.md#native-terminology-and-identity).

[Identity and access](identity-and-access.md) owns Realm participant admission,
multiple Groups/Teams, custom Roles, mixed AuthPrincipal/Entity recipients and
representation. A Realm can govern its own members without an Org parent.
The [experience contract](identity-and-access-experience.md) separates ordinary
participation from collaboration and advanced administration.

## Responsibilities

| Concept | Responsibility | Relationship meaning |
| --- | --- | --- |
| Space | One native Resource identity, lifecycle and admitted capability configuration | Shared identity storage for Realm and Zone capabilities; not a global Resource parent. |
| Realm | Community capability/preset: participants, rules, publication context and local selections | Groups people and content under explicit governance; capabilities and membership have independent admission/state. |
| Collection | Maintained grouping of content or other eligible resources, with explicit stored membership and ordering | Records intentional curation; public and private Collections are both possible. |
| Zone | Routing/presentation capability/preset: URL paths, navigation, docks and subsite infrastructure | Routes to existing Resources, including Collections, and renders them with explicit presentation context. |
| Dynamic Collection | A separately identified, versioned selection rule whose results are computed from native state | Describes a changing result set; it has no implicit stored Collection membership. |

Realm and Collection are both ways to represent grouping relationships. The catalog's Grouping owner also remains available for independently indexed referents such as franchises, series and continuities. Choosing one representation does not manufacture the identities, governance, curation or publishing rights of another.

A user-facing subsite can be composed from a Zone and one or more Collections,
with a Realm where community membership, governance or publication context is
needed. Realm and Zone share the selected `space` identity table; membership,
rules, routes and navigation remain separate capability-owned relations rather
than duplicate Realm and Zone roots. One Space may admit both capabilities, but
ordinary product flows recommend a separate community Realm and presentation Zone
with an explicit relationship. A wiki/site is normally established with a Zone;
Tag classification does not substitute for its routing or content curation.

A Collection can appear in several Zones; a Zone can present several Collections.
Neither mounting nor removing a Collection copies or deletes its content. Capability
retirement preserves Space identity/history and cannot erase the other capability's
state or silently disable its valid references. Deletion/recovery must account for
both sets of dependents. A semantic Zone/Realm label does not activate capabilities.

## Context roles and routing

Both Realm and Zone can provide a Resource context. Bind its role explicitly:
presentation chooses a view; publication identifies an accepted content selection;
governance identifies applicable authority/rules; semantic canon identifies the
world/version in which a claim holds. These roles can use different references.
An undifferentiated `context_id` must not transfer authority between them.

The [address owner](unit-slug-addressing.md) defines SpaceMount, RouteDefinition,
AddressNamespace, SlugBinding and AddressPreference, including UUID, scoped slug,
dynamic parameters, reverse links and current disclosure. Routes resolve to
ResourceRef and context, then use the common rendering flow. A Block document is
content/representation of the resolved Resource, not a route's direct identity.

There is no selected standalone ZonePage Resource or required `post(kind=page)`
ownership relation. Route occurrences retain IDs/revisions for editing and history;
Document/Variant/Revision and Block occurrence identities remain with content.
Two Spaces can present the same Resource without duplicating its body. A route
can pin an accepted revision/selection or follow a declared publication channel;
it cannot silently publish an editing head. External `schema:WebPage` descriptions
remain valid even though the native ZonePage business object is removed.

## Wiki content and grouping relationships

[Realm participation policies](realm-participation-policies.md) supply reusable
subscription admission, action/resource budgets and exact-version review. Rezics Pro
is an ordinary Realm configured through these capabilities. The generic
[Subscribe owner](subscriptions.md) also supports People and native multi-plan
offerings; a Realm is neither a purchased plan nor an entitlement source by itself.
M10 activation is separate from the current IAM/community implementation scope.

[Realm-scoped delivery](realm-scoped-delivery.md) owns site/Realm conjunction,
multi-context reply connections and accepted-version disclosure. A fixed Pro site
uses the same Realm associations and can select a Zone for presentation; neither
its hostname nor a root acceptance admits unrelated replies or grants body access.
Local review, withdrawal and adopted revisions preserve other authorized contexts.

A Realm's wiki pages may be organized as one or more Collections. The same contextual association can also be represented by an explicit "published in" relationship. When Dynamic Collections are activated, a query over that relationship can present the current set of matching pages. These are different contracts: stored curation, a publication relationship and a computed selection are not three independently writable copies of one membership list.

The relationship must identify its subject, publication/grouping context, state and relevant scope or exact revision. A semantic assertion that something was published in a context is evidence, not authorization to publish or adopt it there. An actual platform publication transition remains owned by the publication/Realm command. Define which accepted relationship the query consumes; a title, tag or source claim cannot silently become an effective publication placement.

Collection items reference the native content, Publication or other eligible resource.
Document history, author release and scope adoption keep their existing owners.
A Zone route presents the referenced Resource through the shared renderer; its URL
does not replace the article's identity or editorial history. An item removed from
a Collection may remain published in a Realm, and an item withdrawn from a Realm
may remain in a Collection's retained history while current disclosure follows
policy. A Collection whose meaning is exactly "currently published in this Realm"
should be an explicit query-based selection when supported, rather than an
independently edited mirror.

Content membership in a Collection or Zone placement grants no edit, ownership, publication, read or execution authority. Realm participant membership can select an explicitly configured authorization audience under the identity/access contract; admission alone does not imply every management or content right. Public Collection and Zone pages disclose only authorized members, bodies, media and history. Realm governance scope, semantic/canon context, Collection membership and Zone placement remain separately queryable.

## Examples

- An Azur Lane Wiki can have a main article Collection plus Collections for characters, equipment and editorial guides. A Zone supplies its landing pages and navigation; a Realm can supply its editorial community and rules.
- A Minecraft Wiki can similarly consist of one or several Collections. Minecraft modding can have many separately maintained mod or project Collections, presented through individual Zones or a shared portal Zone.
- One article can be curated into several relevant Collections and rendered in more than one Zone while retaining its native identity. Context-specific adopted revisions may differ without copying the authoring lineage.
- A Realm may have both a manually maintained introductory Collection and, later, a Dynamic Collection selecting its currently published wiki articles. Editing the introduction's membership does not change the publication relationship or the query definition.

## Optional Dynamic Collection implementation guide

Dynamic Collection runtime implementation is outside the required scope of this refactor. The following is an implementation direction for a separately activated extension, not a declaration that the capability exists. Ordinary Collections and Zone-based wiki subsites must work without it.

### Evidence and existing primitives

MediaWiki category annotations create a generated page index; the index is distinct from the page annotations that determine membership. [MediaWiki category documentation](https://www.mediawiki.org/wiki/Help:Categories). Semantic MediaWiki separates query conditions, displayed properties and rendering, bounds query results, and notes that query arguments do not themselves add the queried annotations. [Inline query documentation](https://www.semantic-mediawiki.org/wiki/Results_format). PostgreSQL materialized results can be stale and require explicit refresh. [Materialized-view documentation](https://www.postgresql.org/docs/18/rules-materializedviews.html).

The REZICS design below is an inference from those distinctions and the existing [stored Collection schema](../../libraries/schema/src/postgres/community/collection.ts), [Filter documents](filter-documents.md), [Filter execution](filter-feed-and-zone-experience.md) and [Zone composition](zone-composition-and-theming-decisions.md). Reuse those contracts; importing another wiki's query language or equating a materialized result with curated membership is unnecessary.

### Identity, writes and results

1. Give a Dynamic Collection its own native identity, lifecycle, access policy, immutable query-definition revisions and a small current head with CAS. Keep its persistence and commands separate from `collection`/`collection_item`; do not introduce a `dynamic` boolean that changes the meaning of existing item writes.
2. Store a validated, versioned selection using the existing typed Filter vocabulary, explicit eligible sources/context and a server-supported ordering. Extend the shared vocabulary only where a required publication or Collection predicate is missing. Raw SQL, arbitrary scripts and a second filter language are not accepted query definitions. A Filter or query Block alone is not a Dynamic Collection identity.
3. Distinguish saving a query revision from evaluating it. Initial evaluation returns live, bounded results, with stable tie-breaking, query revision, continuation and explicit complete/partial/unavailable state. A query revision fixes the rule, not the future member set. Results cannot be reordered, added or removed through ordinary Collection item commands.
4. Provide an explicit capture operation if users need stored curation: create a new ordinary Collection with authorized members and provenance identifying the query revision and capture boundary. A stable complete export needs a separately sealed result generation backed by a qualified source snapshot/generation. Sealing alone cannot turn changing live pages into a complete historical snapshot; otherwise describe the capture's bounded live coverage explicitly. Capturing results does not change the Dynamic Collection's identity or grant rights to its targets.

### Execution, disclosure and recovery

Use the existing server-owned Filter/Search ceilings, indexed predicates, candidate budgets and keyset continuation. Start with native facts, explicit stored Collections and publication relationships as sources; recursive Dynamic Collection dependencies and arbitrary query pipelines are not part of the initial extension. Preserve semantic context and Realm scope independently. Query authoring permissions and result visibility are separate checks.

Apply current target access and the hosting Zone's narrowing constraints during evaluation and disclosure. Publishing a query definition also checks disclosure of its referenced sources and parameters; an empty result does not make private query metadata public. A public query must not reveal inaccessible membership, counts, snippets or cursor contents. Cursor compatibility includes the query revision, effective filters/order and relevant definition/result/security generations. Return an explicit stale-cursor or unavailable outcome when consistency cannot be maintained; a cache cannot authorize access.

A mounted Dynamic Collection consumes the hosting page's existing query-Block and aggregate execution budgets. Referencing or nesting a saved selection must not create another independent budget or hide fan-out from admission.

Begin with bounded live evaluation and bounded cache entries. Share cached results only within a proven visibility domain, key them by the query revision and relevant dependency/policy generations, and recheck access before delivery. Do not create one SQL materialized view per Dynamic Collection or synchronously refresh every saved query after each source mutation. If persistence of result generations becomes necessary, add admitted, cancellable, fenced jobs, atomic activation, erasure handling and replay tests before enabling it. Query definitions remain canonical; cached result membership remains disposable derived state.

### Capacity and activation tests

Reuse [capacity policy](data-integrity-and-workload-budgets.md#capacity-planning). Every growing definition/history/result relation must be estimated at 500,000,000 and 3,000,000,000 rows. As illustrative assumptions, a 2 KiB query revision plus 128 bytes of indexes is about 1.088 TB / 6.528 TB; a 96-byte result row plus 64 bytes of indexes is about 80 GB / 480 GB. These are estimates before WAL, replicas and free-space allowance. Result amplification is definitions times retained generations times matching members, so caching every match for every query is not an admissible default. Require explicit definition quotas, cache byte/row limits, skewed-load measurements, bounded response hydration and recovery/erasure costs before activation.

Write cases before implementation: query CAS and history; publication changes entering/leaving computed results while stored Collections stay unchanged; differing results by viewer and Zone scope; revocation between pages and before export; incompatible/stale cursors; hidden counts; empty versus unavailable results; expensive-query rejection; capture provenance/completeness; and, if enabled, cache/job cancellation, stale-worker fencing and erasure after restore. Qualify the shared backend dependencies first. This optional gate does not delay acceptance of ordinary Collection-based wiki composition.
