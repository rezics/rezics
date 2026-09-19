# Realm-scoped sites, replies and delivery

Status: selected target contract, September 15, 2026. This refines the generic
Realm/Publication/Thread contracts for [M10](../plan/modules/subscriptions-and-pro.md).
No runtime, query benchmark or deployed site is qualified by this document.
[Realm policies](realm-participation-policies.md) owns admission, review and metering;
[Subscribe](subscriptions.md) owns plans and independent grant sources;
[capacity](subscriptions-capacity.md#scoped-reply-read-envelope) owns workload bounds.

The [2026-09-19 Space/address target](resource-addressing.md) changes routing and
shared identity representation, not this contract's independent community acceptance
and fixed-site conjunction. Realm denotes the admitted community capability of a
Space; a Zone route supplies presentation context and resolves to the same native
Resource. It cannot replace publication/governance roles or redirect to a general
body that fails this site's boundary. These consumer changes remain unqualified.

## Decision and first release

The first release deploys both `https://rezics.com` and `https://pro.rezics.com`
from one frontend codebase and release version in `apps/web`, sharing native
identities, application capabilities and backend. Main is part of the first launch,
not a later rollout. Site configuration selects the origin, branding/navigation
and content boundary; do not copy routes, pages, components, hooks, SDK integration
or permission presentation into a separate Pro application or long-lived branch.

| First-release site | Server-selected behavior |
| --- | --- |
| Main: `https://rezics.com` | Explicit general site profile; retain ordinary discovery and user-selected Realm scopes under current authorization, without an imposed Pro-only predicate. |
| Pro: `https://pro.rezics.com` | Fixed Pro site profile; add the ordinary Rezics Pro Realm's accepted-publication boundary to all relevant content operations. |

Both sites consume the same configured API client/context provider and site-adapter
implementation. An explicit general profile is different from an unknown/missing
profile: resolution failure never defaults to Main. Separate deployment instances
may use different configuration while keeping the same frontend source/release.
This is the selected launch contract, not a claim that DNS, hosting or authentication
has been configured or either site has been deployed by this documentation task.

Reply publications can have several explicit Realm acceptances while retaining one
utterance identity, original response targets and shared content lineage. Each Realm
independently selects an accepted revision and local presentation. Use parent-local
connections over scope-leading indexed adjacency projections, followed by bounded
native authorization. Do not materialize an entire tree or scan general replies
until a Pro page happens to fill.

## Three independent contexts

| Context | Meaning |
| --- | --- |
| Site profile | Registered deployment identity/revision, canonical origin, fixed content predicate, default presentation Realm, optional Zone and supported endpoint classifications. It narrows the site experience; it does not own content or grant access. |
| Presentation/discussion context | The Realm and Thread/placement whose accepted version, Rules, ordering and interaction state this response uses. One request selects one presentation context; other Realm predicates can narrow it. |
| Authorization context | Authenticated principal, selected authority/Agent, credential ceilings and current resource/benefit proofs from the IAM owner. Site, Origin and Realm parameters never substitute for it. |

For content selection, combine the site's fixed predicate, any hosting Zone boundary
and the user's existing Filter with AND. Bind Realm ID, publication state and local
visibility to the same association. Realm A plus fixed Pro means A intersect Pro;
an `IN (A, Pro)` union is different. Content predicates, text, snippets and media
operate on the version selected in the presentation Realm, not a different Realm's
current head. A public Work reference can be shared without exposing out-of-scope
discussion, activity or private association metadata.

Use a single validated content-context input/resolver across public domain APIs.
Clients select registered site/Realm references; only the server resolves fixed
predicates, permitted surfaces and current configuration. An explicit invalid or
unavailable site/context must not fall back to global. The resolved context is
request-local and carried into queries, commands, hydration and delivery. Separate
it from user Filter input so nested OR/NOT, an empty filter or another Realm ID
cannot erase an enforced boundary. Preserve existing Filter cardinality and semantics.

## Same-origin site adapter

For both first-release sites, browser and SSR content requests use that site's
same-origin API entry. A thin, allowlisted site adapter selects the configured
profile and forwards to the shared domain handlers with the end user's validated
authority. It owns context propagation and origin/session boundaries, not a second
implementation of posts, billing or membership. The backend executes scoped queries;
the adapter must not fetch global data and filter JSON after hydration.

If adapter and backend run separately, authenticate the adapter's declared site
binding or use a server-configured route binding. Strip client-supplied internal
context headers. Normalize/allowlist the external authority and trust forwarded
host information only from the configured ingress. An arbitrary Host, Origin,
Referer, query parameter or service credential alone cannot grant a user's access.
Calling the generic API in an explicitly general context remains a separately
authorized experience; it cannot widen a request through the fixed Pro entry.

Every exposed operation registers one scope behavior:

| Operation class | Fixed-site behavior |
| --- | --- |
| Content discovery | Feed, Search, related items, tags and facets compose the fixed predicate before candidate selection. |
| Content detail and connections | Validate requested root/parent/item in context; hydrate only selected, currently authorized revisions. Counts and child metadata use the same scope. |
| Content mutation | Capture target/destination and authority. Creation/additional publication requires Pro among destinations and defaults to Pro alone. Edit/local-withdraw operations name the Pro selection or authorized pending submission; global source changes remain explicit operations with their own authority. |
| Content delivery | Media, exports, realtime and content-derived notifications preserve context and recheck current disclosure. |
| Account/commerce | Authentication, own purchases/awards, settings and mandatory account notices retain account authority; no accidental Realm filtering of billing or gifts. |
| Public reference | Only registered public catalog/identity lookups may read shared metadata. They do not expand to general social activity or private bodies. |

Unclassified endpoints are not exposed through the fixed-site adapter until their
scope behavior is selected. A generic JSON-rewriting middleware cannot infer these
semantics. Generated clients expose the common context rather than feature-specific
ad hoc headers. Caches/query keys include site revision, presentation Realm, filter,
language, ordering and the necessary private visibility identity. Responses make
the selected context available to routing and draft owners. Changing another tab's
preference cannot retarget a prepared request or draft.

Use the existing identity provider/account system with separately qualified origin,
callback, session and CSRF configuration. Prefer host-only Secure/HttpOnly session
cookies at the site boundary; do not widen them to `.rezics.com` merely for SSO.
Where cross-site sign-in is needed, use the existing authorized redirect flow with
exact registered callback/return origins. A same-origin adapter does not waive CSRF
or user authorization. Cross-origin API use, if elected, needs exact credentialed
CORS configuration; wildcard origins are not a substitute. The authenticated API
origin, OAuth callback and cookie ownership must agree in the deployment contract.

The public-site domain list is bounded deployment configuration, not a hostname
derived from arbitrary Realm slugs. Zone can supply pages/navigation and another
narrowing boundary without becoming a security tenant or changing content identity.
Keep routing adapters thin under the [web feature organization](web-feature-organization.md).

Keep native IDs and the [slug/address registry](resource-addressing.md) authoritative.
The site origin is presentation/deployment context, not a second canonical slug
store. Site routing constructs links that preserve the selected context and exact
content reference; backend presenters still return IDs and optional slug addresses.
Navigating to general content requires an explicit destination outside the fixed
Pro view, rather than a redirect that silently drops the enforced context.

## Reply identity and multiple Realm acceptance

Distinguish authoring one reply, publishing/accepting that reply in additional
contexts, and authoring a new repost. One reply can be accepted in A and Pro and
appear in both lists with the same native publication identity. A separate authored
repost has a new utterance identity even if it reuses the same Document revision.
Equal text, shared authorship and derivation do not manufacture Realm associations.

The original root/parent response and exact citation remain causal facts. A Realm
acceptance does not rewrite them. Local display placement is separately scoped to
Thread/generation and may cite the accepted reply; the first projection uses one
current placement per reply/context/thread. General repeated-placement capability
does not require duplicate default reply cards. Counts name whether they count
publications or placements; first ordinary reply connections count unique accepted
reply publications within that parent connection.

### Authoring and additional publication

Replace the current singular create-reply destination with an explicit bounded set
plus a captured originating discussion context. A Realm origin is required among
the destinations. The generic API also preserves ordinary platform-origin replies
with no Realm destination; it does not manufacture a global Realm. Pro's fixed
site requires the Pro Realm origin/default and cannot use that general alternative.
Validate input and author/origin admission before creating anything;
if origin admission fails, no reply or secondary publication is created. An admitted
origin can be pending review. Allocate one reply under a stable operation identity;
record per-destination pending/accepted/denied outcomes without claiming all succeeded.
Replays return that original reply and do not duplicate meters, reviews or notices.

For each destination, validate current source publication-management authority,
`realm.post.replies.create`, exact Rule consent, metering/review policy, and the
root/immediate parent's accepted readable placement in that destination. Supporting
an existing author-approved acceptance is different from creating a new author's
utterance. Generic Resource publication, republish and adoption endpoints must dispatch
reply subjects through this same policy; `realm.units.create` alone is insufficient.
An unavailable parent does not automatically publish general ancestors into Pro.

Resolve each destination's Thread and parent placement through its exact accepted
publication mapping. Do not copy the origin Thread's placement ID into another
Thread's parent FK. Original response identity and local parent placement are
separate keys; missing or ambiguous destination mappings are explicit outcomes.

Each destination fixes its exact accepted content/dependency revision. A succeeds
while Pro is pending or rejected without changing A's decision. The first API
supports at most the admitted destination count in the capacity owner, with stable
per-destination effect keys and deterministic lock ordering. New native replies
use the existing nonrecursive leaf-insertion protocol; they do not build ancestor
closure rows or clone a complete Thread generation on every write.

Root/immediate-parent checks are local connection/admission checks, not an assertion
that every ancestor is public. A hidden parent is omitted from ordinary tree traversal
and is not expanded. Existing descendants keep their own identity and acceptance;
they are not silently deleted, promoted to roots or attached to a different parent.
Directly opening an independently readable child may show its own content, with
inaccessible parent identity/quotation withheld. A request to expand a parent must
authorize that parent in context, even if its ID came from an older cursor. An
explicit governed placement operation is needed to reorganize a branch. Removing
an ancestor must not synchronously rewrite an arbitrarily large descendant subtree.

### Connection API and cursor semantics

The primary read unit is one root/immediate-parent connection, not an entire tree.
Inputs select content context, native Thread/root, optional parent placement, page
size and opaque continuation. A convenience response may batch bounded direct-child
previews for the returned parent page; every connection consumes one shared request
budget. Initial display remains at most two levels, with deeper expansion explicit.
For a Thread without a selected root publication, authorize the Thread entry itself;
do not create a dummy root or reinterpret unresolved causal origin as top-level.
An explicit origin/global view uses native adjacency with the same authorization
and scan-budget rules; it is not implemented by copying every reply into a synthetic
Realm. It cannot be selected through a fixed Pro content entry.

Default sibling order is context acceptance/insertion order with a stable placement
identity tie-breaker. Record original authorship time separately. Accepted-version
edits do not bump the order. Withdraw then republish creates a new inclusion episode,
without recreating the original utterance. Custom reordering or a topology-generation
change invalidates incompatible cursors through an explicit restart outcome.
Return the inclusion episode with the native reply identity. A live client that
encounters a republished reply reconciles its current card by context/reply identity
rather than treating the new episode as a second active utterance or vote.

Pages are live keysets, not a claim of a historical snapshot. Current authorization
and accepted revisions are rechecked per request. Newly committed inclusions behind
a continuation frontier may require refresh; sealed complete exports use the existing
snapshot/export protocol. New replies must not invalidate every cursor by incrementing
a global Thread version. A meaningful layout/scope change does invalidate it.

The continuation binds site/config revision, presentation Realm and required predicate,
Thread/layout generation, root/parent, filters/order, viewer visibility context and
last consumed ordering tuple. Use the existing authenticated opaque-value codec;
encrypt scan frontiers that may contain IDs of filtered/private candidates. The
current base64 JSON reply cursor is not sufficient for such private frontiers.

Return explicit connection progress rather than overloading one boolean:

| Field | Meaning |
| --- | --- |
| items | Currently authorized reply/placement identities and their exact selected revisions. |
| more | `yes` only after witnessing an additional authorized matching edge; `no` only after proving source exhaustion; otherwise `unknown`. |
| continuation | Opaque next scan position when more candidate work is possible. It does not assert that another visible reply exists. |
| completeness | Complete for the requested page, or partial because an admitted candidate/authority/output budget was exhausted. Unavailable authority is separately reported, not an empty successful page. |
| childConnections | Independently scoped child preview items/progress, with the same rules and no hidden-child existence claim. |

Advance past the last consumed candidate, not past unreturned authorized lookahead
items. If the page fills before a scanned chunk ends, continuation preserves its
unreturned tail. A no-hit bounded page can have continuation; clients do not
automatically issue an unlimited chain of follow-up requests. Unknown child progress
uses a neutral explicit load action, not a positive hidden-reply count. A Relay-style
boolean adapter is permitted only where its stronger existence semantics are proved.
Do not consume a candidate with unresolved authority as though it were denied:
stop that connection before the unresolved position and report partial/unavailable
so a retry can evaluate it. Output-budget reduction likewise preserves unreturned
visible items rather than claiming exhaustion.

### Batched current authority and counts

For a connection read, authorize its Thread/root entry and requested parent first,
then every candidate reply's current resource, selected revision/dependencies and
required Realm acceptance. Root access, membership or an active Realm association
alone does not authorize a private reply.
Do this before exposing body, summary, author details, translations, attachments or
child metadata. Coordinate selection and hydration with native current-authority
fences so intervening withdrawal/erasure cannot turn an earlier candidate into stale
allow. Authorized tombstones are separate presentations; deleted private bodies are
not safe merely because the root is public.

Use bounded batch authorization and owner-grouped hydration, including edit/reply
capability summaries. Do not make one independent `canUpdate`/`canRead` request per
returned reply. Missing/unavailable proof is explicit; caches are not permission
receipts. Every default, parent-expansion and direct-detail path uses the resolver.
An independent direct reply-resource read retains its native access policy and
required Realm acceptance; it is not an implicit ancestor-tree read. Disclose root,
parent and quoted context only under their own policy, with explicit unavailable
relationship state when withheld. This preserves readable child identity without
granting traversal into an inaccessible parent connection.

Replace a scoped view's global `replyCount` with an explicitly scoped count result.
Direct-child counts can use striped same-audience counters when their generation
and current disclosure match the viewer. If private restrictions, blocks or stale
updates prevent that proof, return a lower bound from witnessed visible items or
unavailable; do not label an approximate/global count exact. Descendant totals are
not computed by walking a subtree on every request. Neither `hasMoreChildren` nor a
count may reveal a private child that the returned connection would withhold.

## Physical query plan and lifecycle

Use a rebuildable `realm_reply_projection` over accepted publication selections
and native Thread placements. Store Realm, Thread/layout generation, root, immediate
parent placement, accepted selection, inclusion episode/order and native reply ref.
Keep body text, causal origin, membership and permissions in their owners. Concrete
selection/placement keys enforce correspondence; projection rows are never grants.

The elected connection index begins with Realm, Thread/layout and parent selection,
then the immutable order tuple. A root connection has an explicit null/sentinel
parent contract; avoid a mixed `parent IS NULL OR parent = ...` query that defeats
the seek. Realm/root reverse paths support repair and direct context inspection.
This joined projection is needed because adding `realm_id` to an index on the
current `post_reply` table cannot index a column that exists only in `realm_unit`.

The ordered source index contains only the projection's active inclusion episodes
(a state-based partial predicate, not a time-dependent permission expression).
Expired/withdrawn episodes live in their history/retirement paths rather than an
ever-growing active scan range. Projection eligibility still requires current
authoritative acceptance checks; lagging cleanup never grants disclosure.

Seek a fixed raw candidate window inside the Realm/parent index first, then run
batched visibility/filter probes and hydrate only permitted output. SQL LIMIT after
an unrestricted EXISTS/join is not a scanned-row budget. Parent previews and
lookahead also consume the shared raw-candidate allowance. A bounded LATERAL batch
is valid; recursive CTEs are available for separately admitted topology jobs, not
unbounded interactive discovery hidden behind a small result limit.

Update an accepted reply's small projection atomically with its selection/placement
when on the same write authority. Bulk imports and topology changes use staged
generations, bounded delta catch-up and atomic activation. Reject stale workers.
Local withdrawal changes eligibility immediately and coalesces projection/count
repair. A large ancestor withdrawal invalidates its connection without deleting
every descendant row. Hash/partition placement and wider sharding follow the
capacity owner; a new projection is not proof of a single-node 3B-row deployment.

## Existing implementation evidence

Source inspection on September 15, 2026 found these concrete gaps, not measured
production failures:

- [Post/reply schema](../../libraries/schema/src/postgres/forum/post.ts)
  gives replies native Post identity and one root/parent; [Realm associations](../../libraries/schema/src/postgres/realms/realm.ts)
  allow multiple contexts. [CreateReplyBody](../../services/main/src/services/api/posts/schema.ts)
  still accepts only one `realmId`, so multi-destination authoring is not complete.
- [Reply selection](../../services/main/src/services/api/posts/reply-tree-query.ts)
  applies Realm EXISTS before LIMIT on root/child candidates. It bounds returned
  depth/items but does not prove bounded sparse-Realm physical scans.
- [Reply handlers](../../services/main/src/services/api/posts/index.ts) check the
  root, hydrate selected replies without an adjacent per-reply current-read proof,
  call per-item `canUpdate`, and use global `postReplyStat` for detail reply counts.
  These paths must be replaced/qualified before protected Pro delivery.
- [Query tests](../../services/main/src/services/api/posts/reply-tree-query.test.ts)
  mock database execution and inspect SQL/cursors. They do not supply native query
  plans, sparse-Pro load evidence or full authorization acceptance.
- The current [Web worker](../../apps/web/worker/index.ts) and [API entry](../../services/main/src/services/api/index.ts)
  do not establish this fixed-site contract. CORS/trusted origins and adding a Realm
  parameter alone do not make a new domain ready for production.

## Alternatives and research basis

Primary sources consulted September 15, 2026. The selected composition is a REZICS
design, with [SITE/RPLY acceptance](../testing/subscriptions-and-pro.md#scoped-site-and-reply-cases)
and native capacity work still pending.

| Alternative / source | Finding and selected consequence |
| --- | --- |
| Existing adjacency plus late Realm EXISTS | Minimal storage change, but sparse intersections can inspect many unrelated siblings. Retain native adjacency and add the scope-leading read projection. |
| Whole recursive tree with outer LIMIT; [PostgreSQL WITH](https://www.postgresql.org/docs/18/queries-with.html) and [EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) | LIMIT/output rows do not establish bounded work through sorts, joins or recursion. Select bounded parent connections and measure buffers/rows before claiming performance. |
| Materialized paths/ancestor closure; [PostgreSQL ltree](https://www.postgresql.org/docs/18/ltree.html) | Useful for elected ancestry/subtree operations, but per-ancestor/per-Realm storage and reparenting amplification are unnecessary for ordinary direct-child pages. Do not add them as a prerequisite for this interface. |
| Per-user or per-Realm body copies | Larger write/storage/erasure burden and risk of diverging identity. Reuse exact body revisions and duplicate only necessary accepted-context projection rows. |
| [ActivityStreams Vocabulary](https://www.w3.org/TR/activitystreams-vocabulary/#dfn-context) | Object identity, context, inReplyTo and audience are distinct. This is semantic evidence, not a specification of REZICS permissions, storage or mandatory federation. |
| [Relay Cursor Connections](https://relay.dev/graphql/connections.htm) | Connections bind cursors to one ordered relationship and define precise more-edge semantics. Retain opaque scoped continuation, but expose unknown when a work budget cannot prove a boolean. |
| [PostgreSQL multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html) | Equality-leading keys support Realm/parent seeks. Planner selection, skew, update cost and end-to-end latency remain measurement obligations. |
| [AWS application-enforced isolation](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/application-enforced-pool-isolation.html) | Enforce policy at resource access through shared infrastructure; a site selection is neither authentication nor tenant-wide authority. |
| [OAuth Security BCP, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1) and [cookie scope](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie_prefixes) | Exact callbacks and host-scoped cookies support an independent frontend with shared identity. They do not qualify a deployed reverse proxy, identity adapter or SSO flow. |
