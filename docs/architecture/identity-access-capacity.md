# Identity and delegated-access workload envelope

Status: planning estimates and qualification obligations for
[identity/access](identity-and-access.md) and [connected apps](connected-apps.md).
No new SQL, sustained load or recovery benchmark ran for this document refactor.
Apply the [capacity policy](data-integrity-and-workload-budgets.md#capacity-planning).
The existing [whole-database workbook](database/capacity.md) does not include these
new relation families automatically; combine inventories without double-counting
their replacement of older membership/grant/token rows.

## Cardinality and storage

Budget every potentially large relation at 500,000,000 and 3,000,000,000 rows.
The estimates below include a current row and its expected indexes, before bloat,
WAL, backups, replicas, reserve and separately stored payloads. GB uses 10^9 bytes.
They are design inputs, not measurements or safe physical-layout commitments.

| Relation family | Assumed bytes/row including indexes | 500M rows, GB | 3B rows, GB |
| --- | --- | --- | --- |
| Enrollment or direct group-membership edge | 240-400 | 120-200 | 720-1200 |
| Principal/Entity or external-account binding | 224-384 | 112-192 | 672-1152 |
| Role binding or scoped grant | 320-512 | 160-256 | 960-1536 |
| Representation grant or live parent dependency | 384-640 | 192-320 | 1152-1920 |
| Consent or installation scope grant | 384-640 | 192-320 | 1152-1920 |
| OAuth client configuration | 1024-2048 | 512-1024 | 3072-6144 |
| API-key/other credential metadata; opaque OAuth rows are inventoried below | 256-512 | 128-256 | 768-1536 |
| Security transition event | 512-1024 | 256-512 | 1536-3072 |

Count each stored dependency, selected resource and event separately. With M
enrollments and g direct groups per enrollment, group membership adds M*g edges;
with d explicit live dependencies per delegation, dependencies add D*d rows.
The same principal controlling several Entities creates several representation
edges, not several credential stores. An installation-specific client adds one
client per installation, not one per API request. A shared public Entity reference
does not require copying its biography or private controllers into each platform.

Role definitions and permission dictionaries may be scope-bounded, but the total
scope count is not globally bounded. Inventory scope heads, definition revisions,
role-permission entries and retirement history separately using measured width
and the admitted scope/role/retention counts. An enrollment transition ordinarily
writes its current relation and an immutable event; role changes write a definition
revision and head, not one replacement ACL for every group member/resource pair.

## Workloads and access paths

Initial qualification inputs reuse the existing owners' 100 membership/control
changes/s normal and 2,000/s global peak, up to 1M members in a hot owner, and
10,000 roster/inbox pages/s. Add a distinct authorization workload of 10,000
decisions/s normal and a fivefold burst, with mostly reads and explicit private
write/installation mixes. These are scenarios to test, not traffic forecasts.
Do not add all owner's peak rates unless that combined scenario is intentionally
being qualified. Run cold/warm cache and hot scope/principal/resource distributions.

| Path | Required indexed shape / bounded work |
| --- | --- |
| Login/default | Principal and default-binding point reads, current representation/Entity validation; no scan of all controlled identities. |
| Roster and group lists | Scope/subject or group/subject keysets; reverse subject/scope indexes; bounded label hydration. A filtered empty page can carry continuation. |
| Target authorization | Target/scope/action binding candidates, selected-subject membership probes, role heads and bounded representation dependencies. No whole-roster expansion. |
| Subject administration | Principal/Entity/grant reverse keysets; public response must not expose private recipient mappings. |
| Role activation | Role/revision head, scoped binding-impact pages and ceilings; no per-member ACL rewrite. Large impact review is resumable and revalidated before activation. |
| Revocation | Exact grant/admission/installation state and epoch update, reverse dependency index, later bounded cleanup. Required live checks invalidate descendants before cleanup finishes. |
| Token verification | Unique digest or verified audience/subject plus exact live consent/installation context; rate-limited introspection and issuer-scoped key caches. |
| Privacy deletion | Principal/binding/token/recipient reverse indexes, child-before-parent batches; retain independent Entity and institutional assignments. |

Candidate evaluation and administration listing are separate APIs. Proposed initial
execution budgets are group and representation depth at most eight each, at most
64 direct groups per selected subject/scope, at most 256 relevant binding candidates
per decision, 100 rows returned per page and 512 scanned candidates per filtered
page. Validate and tune these before admission; they are operational budgets, not
intrinsic identity or role cardinalities. Exhaustion yields an explicit unavailable
decision or resumable administrative continuation, never a partial allow or a
silently incomplete list. Large changes use staged, revision-bound impact review.

Permission sets are bounded by the registered action vocabulary. Client metadata,
audit detail and token context have separate encoded-byte limits; proposed fixture
ceilings are 64 KiB client metadata, 8 KiB event detail and 8 KiB credential context.
Do not embed whole rosters/role graphs or raw credentials. Peak payloads, not only
mean widths, determine batch/network/WAL limits. Large secret-free audit payloads
need separately owned encrypted/suppressible evidence rather than unlimited rows.

Proposed warm-database goals: authorization p95 <= 50 ms, 100-row reads p95 <= 100 ms,
small authority changes p95 <= 200 ms, excluding client transport. Record p99,
errors, unavailable decisions and lock waits. An admission envelope of up to 12
application SQL statements per decision would imply up to 120,000 statements/s
at the normal decision scenario, before other traffic and trigger work. This
upper bound is deliberately not a throughput claim: batch probes, measure actual
query count/buffers and qualify the resulting topology before accepting it.

## Contention, consistency and growth

Group/role/representation updates serialize on affected authority keys. Shared
reader fences must not become a global lock. A popular parent group, role head,
Entity controller or installation can still be hot; measure fan-out, fence hold
time and cache-dependency size. Do not materialize every transitive subject/resource
pair, or invalidate it with an unbounded synchronous fan-out on each change.

Local authorization and domain mutations can share one transaction. If an external
engine is selected, qualify authoritative writes, outbox/projection lag, failure
semantics and content/authorization ordering first. [OpenFGA consistency modes](https://openfga.dev/docs/interacting/consistency)
and [SpiceDB consistency tokens](https://authzed.com/docs/spicedb/concepts/consistency)
show why an engine choice alone is not a freshness guarantee. Their documented
tradeoffs do not establish the performance of this workload.

Use finite worker queues/admission, coalesced invalidation work and indexed cleanup
batches of at most 500 small rows, reduced by payload-byte budget for wide records.
Measure dependencies per grant, writes per transition, WAL and replica traffic;
two transition events of 512-1024 bytes each add 1-2 KiB per lifecycle before other
writes or WAL amplification. Expired credentials/events require declared retention
and reconciliation; do not turn background expiry into a full-table recurring scan.

Monitor p95/p99, candidate/depth exhaustion, grant/token verification rates, hot-key
lock wait, queue age, failed deliveries, cache freshness, disk/index working set,
WAL/replay lag, dead tuples and restoration time. Review capacity when latency
goals are sustained above budget, a cleanup backlog exceeds five minutes or storage
exceeds 70%; backpressure prevents unlimited admitted work while the cause is fixed.

Growth direction is scope-local membership/grants with principal-routed private
reverse lookup and independent immutable history/retention partitions. Before
sharding, specify routing keys, cross-owner references, uniqueness, fencing,
revocation and restore frontiers. Hash partitioning alone provides no additional
machine capacity or global uniqueness. A 3B-row layout may require a different
topology; no local fixture or published vendor result waives that qualification.

## Opaque protocol cost

The [selected external profile](connected-apps.md#qualified-external-token-profile)
stores one opaque access-token row for each issuance, including client credentials.
User offline issuance also creates a refresh-token row; rotation creates new access
and refresh rows and retains/revokes prior records under the provider lifecycle.
Count these rows separately from consent, installation and live dependency records.
The generated provider tables have a more specific index inventory than the initial
generic credential estimate. The provider-row budgets below replace that estimate
for OAuth access/refresh records; do not add both estimates for the same row.
Retained revoked tokens, maximum payloads, WAL, replicas and reserve remain separate.
The adapter fixture does not measure or accept these widths.

The September 14, 2026 Bun/Drizzle fixture counted nine SQL statements for each of
two successful opaque MCP verifications through authenticated HTTP introspection.
These are small warm protocol-only samples, including provider client/token/user/
session and resource-link probes, with no REZICS domain authorization. At 10,000
verifications/s this observed path alone implies 90,000 statements/s; at the
fivefold burst it implies 450,000/s. This arithmetic is not measured throughput.
It would consume nine of the proposed twelve combined statements per decision,
leaving only three for domain policy; do not accept that combined budget without
measuring the actual composition.

The next capacity qualification must measure complete domain decisions, cold/warm
plans, unique token-digest and reverse dependency indexes, hot clients, repeated
introspection, expiry/rotation cleanup and retained families. Profile activation
requires bounded credential admission/retention and indexed cleanup of at most
500 small rows per batch. Optimize private in-process verification or bounded
shared reads if the remote protocol overhead prevents the combined target, while
preserving exact live revocation and the external privacy presentation boundary.
No offline allow cache or larger unchecked query budget is elected by this fixture.

The production protocol generator includes the provider's unique token digests,
client/user/session and refresh/code reverse indexes plus expiry/ID keysets. Planning
bytes per row including those indexes are 1,536 for client metadata, 640 for a
client/resource link, 1,024 for opaque access metadata, 1,152 for refresh metadata,
768 for protocol consent and 320 for assertion replay protection. At 500M rows
these are 768, 320, 512, 576, 384 and 160 GB respectively; at 3B rows, 4,608,
1,920, 3,072, 3,456, 2,304 and 960 GB. They exclude large optional metadata/replay
payloads and all operational overheads. Measure real tuples/indexes in verification.
Count native consent/context/installation records separately from protocol rows.
Server JWKS and registered API resource definitions are configuration inventory,
not one row per account or selected Realm/content resource. Cleanup must preserve
live token dependencies and use bounded child-before-parent work.

## Private registry cost

The subject and scope registries have independent allocation density: one subject
value per participating AuthPrincipal or Entity and one authority root per admitted
private account, public resource or platform. They are allocated on first authorized
use, not for every catalog object automatically. Each membership, role binding,
representation edge and token dependency remains a separate relation. Public scopes
reuse existing REF values; count a newly needed REF under the Unit bridge inventory
once, not once per access feature.

Budget each registry at 96 heap bytes plus 128 index bytes per row (224 total):
112 GB at 500M rows and 672 GB at 3B rows, before reserve, bloat, WAL, replicas,
backups and retained dependent records. Together, equal 500M/3B populations add
224 GB/1,344 GB. These conservative estimates include headroom above the small native sample;
maintenance and target-scale qualification remain pending. The single platform root is bounded, but the containing scope
relation is potentially corpus-scale and uses both planning baselines.

Each row enters its UUID primary key and exactly one partial unique target index.
A hit performs one indexed read and no update; first allocation performs a read
and insert, with one additional point read after a READ COMMITTED conflict. Only
competing first admissions for the same target serialize. Reads resolve one narrow
row without hydrating groups, role graphs, resources or private presentation.
The immutable registry is not an authorization cache; live-policy reads and fences
remain additional work under the combined decision budget.

The native fixture adds 10,000 principal subjects and private account scopes and
checks unforced point-read plans, tuple width and heap/index bytes. It also exercises
commit/rollback allocation, owner deletion and stronger-isolation races. This small
warm sample is not sustained throughput, hot-owner contention, vacuum/WAL, erasure
or restoration acceptance. Keep target uniqueness intact; partitioning solely by
value UUID would lose it and requires a separately qualified design.

The [initial native registry run](../testing/database/access-identities-evidence.json)
measured approximately 56 tuple bytes for both families. Its 10,004 subjects used
606,208 heap bytes and 778,240 index bytes; 10,006 scopes used 606,208 heap bytes
and 794,624 index bytes. Both point reads selected their partial unique index and
three shared buffer hits. This fresh, small distribution supports the conservative
224-byte planning input; it does not establish sustained load or provisioning.

## Role definition storage

Role definitions are not assumed globally bounded by their owner scopes. Inventory
heads, definition revisions, permission members and control events separately at
500M and 3B rows. A definition contains at most the number of registered permission
references, with at most 512 UTF-8 label bytes and 4,096 description bytes. Permission
families remain explicit even for identical key strings.

| Relation | Planning bytes/row including indexes | 500M, GB | 3B, GB |
| --- | --- | --- | --- |
| Role head | 224 | 112 | 672 |
| Sealed definition header | 640 | 320 | 1,920 |
| Permission member | 224 | 112 | 672 |
| Private control event/receipt | 384 | 192 | 1,152 |

These estimates precede reserve, bloat, WAL, replicas and backups. The definition
estimate assumes an 80-byte label and 256-byte description; maximum payloads add
up to 4,608 bytes before structural/TOAST costs and must be provisioned separately.
With R definitions and P authored permissions per definition, membership adds R*P
rows. Revision count and activation/retirement event count are independent; a role
with ten revisions of eight permissions has eighty permission rows, not ten.

A complete revision writes an event, a small staged header, P immutable permission
members, a seal and a head update in one bounded owner transaction. Activation and
retirement write one event and one head update, with no synchronous fan-out over
bindings or members. Current readers must check active role state; token/binding
ceilings remain independent and must not expand merely because a head changes.

Role history and scope lists use keysets. Exact snapshot reads use the head and
composite definition/permission keys and return at most the registered permission
count; they are management reads, not the hot effective-access query. Effective
permission evaluation must batch role/binding membership probes instead of invoking
one snapshot hydration per candidate. Same-role writes serialize on the narrow
head; different roles share only compatible scope FK locks. Active reads use head
share locks, and mutation owners must promote overlapping authority locks upfront.

The native fixture adds 1,000 roles plus a role with 100 further revisions and
measures their events/permission members,
checks unforced exact-key plans, and exercises state, admission, receipt and
concurrency behavior. This does not measure sustained traffic, 500M/3B operation,
retirement/erasure cleanup, wide-payload load or restoration. Permission retirement
needs its own retained-history vocabulary and intake/effective-use policy; role
retirement alone does not qualify that separate lifecycle.

The [pinned native sample](../testing/database/access-roles-evidence.json) has 1,110
definition headers, 2,213 permission members and 1,115 events. Mean tuple sizes are
approximately 130, 64 and 192 bytes respectively. Table/index bytes are
344,064/98,304, 196,608/196,608 and 262,144/172,032. The long-history probes use their
complete revision, permission and event primary keys. The sample has short labels
and null descriptions; it is not evidence for maximum payloads or sustained load.

## Membership generation storage

Shared membership identity is unique by scope and typed subject. Each new admission
adds one immutable generation; departure preserves it and clears only the head's
active selection. Rejoin creates a different generation, so generation-bound groups
and grants cannot revive by matching the membership identity alone.

| Relation | Planning bytes/row including indexes | 500M, GB | 3B, GB |
| --- | --- | --- | --- |
| Membership head and scope/subject indexes | 640 | 320 | 1,920 |
| Retained admission generation | 192 | 96 | 576 |
| Private transition event/receipt | 448 | 224 | 1,344 |

Counts are independent: M identities with G admissions each create M*G admission
rows, plus their separate departure/control events. These estimates exclude bloat,
WAL, replicas, backups and reserve. Both global planning scales apply even when an
individual scope has few members. Head lookup uses the scope/subject unique index;
reverse subject/scope and exact admission/event keys avoid roster expansion.

An admission writes a receipt, an admission key and one head update; departure
writes a receipt and a head update. Neither scans or rewrites old group assignments.
Permission and disclosure owners must compare the recorded admission key against the
current active generation and enforce actor/subject eligibility and independent
restrictions. They must not treat an active head as a complete access decision.
Current policy predicates run before writes, after head-lock waits and in the final
update. The native sample measures 1,000 memberships plus a member with 100 further
transitions, checking exact history keys and separate generation/event rows;
full policy, hot-scope throughput, cleanup and restore remain separate qualification.

The [pinned native sample](../testing/database/access-memberships-evidence.json)
contains 1,003 heads, 1,054 admission generations and 1,107 events. Mean tuple widths
are approximately 96, 56 and 192 bytes; table/index bytes are 229,376/360,448,
90,112/73,728 and 262,144/172,032. Head sizing includes reserve above the observed
fresh insert/update footprint; sustained churn and vacuum still require measurement.
The two history probes use their complete primary keys, while the head probe uses
the equivalent subject/scope index. These small samples are not capacity acceptance.

## Group topology storage

Inventory tree fences, Group heads and immutable snapshots separately at 500M and
3B rows. One scope may own many Groups; Group count is not globally bounded by the
maximum ancestry depth. Snapshots contain at most 512 label bytes and 4,096 optional
description bytes. Current heads contain no presentation payload or roster.

| Relation | Planning bytes/row including indexes | 500M, GB | 3B, GB |
| --- | --- | --- | --- |
| Scope tree fence | 160 | 80 | 480 |
| Group head and parent indexes | 640 | 320 | 1,920 |
| Private snapshot/receipt with typical presentation | 768 | 384 | 2,304 |

Snapshot sizing assumes an 80-byte label and 256-byte description; maximum payloads
require up to 4,608 bytes plus structural/TOAST costs. All estimates exclude bloat,
WAL, replicas, backups and reserve. Tree fences have one row per participating scope,
not per member; event count follows control changes rather than membership size.

A parent change writes one snapshot, one Group head and one tree version. Height
maintenance updates at most the old/new ancestor chains (up to fourteen ancestor
steps at the depth-eight envelope), each using the ordered active-child maximum.
It does not synchronously write descendants. Current readers share a scope tree
fence; any topology or metadata control mutation serializes there. This conservative
initial boundary makes future roster and impact snapshots explicit, but a hot scope
can limit throughput. It must be measured against the combined authorization and
100/2,000 changes/s scenarios before acceptance; the small fixture is not that test.

The fixture uses 1,000 siblings, a depth-eight chain and 100 repeated metadata
transitions. It checks unforced maximum-child and exact historical event plans,
records separate table/index footprints and tests lock waits in different scopes.
It does not qualify sustained traffic, maximum payloads, vacuum/WAL, recovery,
large assignment-impact review or a distributed topology.

The snapshot helper is a management read: a shared tree fence and an exact
head/event join. Effective access must batch selected-subject Group and binding
probes under the combined decision budget; invoking this helper separately for
every Group candidate does not qualify the proposed hot authorization path.

The maximum-child query spells `DESC NULLS LAST` to match Drizzle's emitted index
ordering. A PostgreSQL 18.6 probe over 1,000 non-null heights planned a sequential
scan and sort for plain `DESC`, while the matching null ordering used an index-only
scan. The scoped Group fixture rejects a sort/sequential scan and requires its
maximum-child index scan to return one row. Nullability alone does not establish
that the planner treats these orderings as interchangeable.

The [pinned native Group sample](../testing/database/access-groups-evidence.json)
contains 1,023 heads and 1,134 control snapshots, with mean tuple widths of about
90 and 223 bytes. Table/index bytes are 221,184/417,792 and 303,104/188,416.
The maximum-child plan reads one indexed row using three shared buffer hits; the
history query seeks its exact Group/version primary key. The two repeatedly
updated tree fences occupy 81,920 table and 16,384 index bytes at this sample cut;
that churn footprint is not a per-live-row provisioning estimate. Hot-scope
vacuum, WAL and sustained contention remain separate capacity obligations.

## Direct Group membership storage

Every admission now creates an empty selection-set fence, including admissions that
never select a Group. Count these alongside immutable admission keys rather than
estimating them only from nonempty Group memberships. A scope tree is initialized
on first membership admission or Group creation; it is not copied per admission.
Membership commands acquire that tree before the enrollment lock. This is an
additional admission write and fence read, not a free change to the earlier
membership-only workload estimate.

| Relation | Planning bytes/row including indexes | 500M, GB | 3B, GB |
| --- | --- | --- | --- |
| Per-admission selection-set fence | 384 | 192 | 1,152 |
| Direct selection head and lookup/roster indexes | 640 | 320 | 1,920 |
| Private selection event/receipt | 512 | 256 | 1,536 |

These are planning inputs before bloat, WAL, replicas, backups and reserve. With M
admissions and G Groups ever selected per admission, there are M set fences and
up to M*G retained selection identities, plus one event per assign/remove/prune.
The 64 selected-slot budget bounds current probes, not historical G or revision
counts. A transition writes one event, one selection head and one set version;
it does not copy every other selected Group into a new snapshot.

The selected-slot partial index reads at most 65 candidates to detect exhaustion.
Current use evaluates at most 64 roots and eight ancestors per root (512 path
rows), under shared tree/enrollment/set fences. It checks the budget before
filtering retired Groups. A missing set or incomplete path is unavailable. Group
roster candidates have a separate group/member/generation keyset index; public
roster disclosure and filtered-page budgets still require their owner policy.

Prune commands close only permanently ineffective selections. Bounded maintenance
can reclaim at most 64 obsolete slots in one admission; ordinary assignment has
no hidden multi-selection effect. Admission expiry or denial rolls back the one
command even if its caller catches the failure. Higher-level cleanup orchestration
must recheck current authority and cannot count partial work as an assignment.

Qualification includes mixed subjects, rejoin, removal/reassignment, terminal
retirement, concurrent slot admission, stronger-isolation stale reads, expiry after
lock waits, the full 64-by-eight path budget, a 1,000-member roster and long
selection history. Small warm plans do not establish the combined 10,000-decision/s budget, hot-scope throughput, cleanup
service rate, erasure or recovery at either corpus-scale baseline.

The [pinned native sample](../testing/database/access-group-memberships-evidence.json)
contains 3,062 set fences, 2,146 direct selection heads and 2,364 selection events
after the final focused rerun on the full-gate fixture.
Mean tuple widths are approximately 72, 89 and 208 bytes; table/index footprints
are 352,256/475,136, 368,640/589,824 and 548,864/507,904 bytes. The estimates above
include headroom over this insert/update footprint, not a measured provisioning
promise. Set lookups use their complete membership/generation key through either
the primary or same-prefix scope index. Selected-slot and roster probes use their
partial indexes; long history uses the complete event primary key. The 512-path
functional case validates the read bound, not sustained authorization capacity.


## Permission ceiling computation

The shared permission set operations admit no more input entries than the current
registered vocabulary size P. They canonicalize family-qualified references and
return at most P values. Snapshot and coverage work expands the bounded authored
closure; effective clipping checks every candidate's prerequisite set against a
hashed explicit approval. With E registered implication edges, worst-case work is
O(P*(P+E)), with O(P) result/working-set storage apart from temporary closure arrays. This is per-set computation, not a
measured end-to-end authorization decision or a substitute for bounded binding
candidates. Persisted approval rows and their amplification belong to the binding
and delegation capacity inventories; the pure helper introduces no stored rows.

## RoleBinding storage inventory

Count target-root fences, binding identities, terms revisions, private control
events and explicit approved-permission members separately at 500M and 3B rows.
Root fences follow admitted scope count, including roots with no bindings, so
negative candidate reads have a concrete version to lock. A binding is one
recipient/role/target combination; overlapping bindings do not copy rosters.

Candidate planning inputs (before bloat, WAL, replicas, backups and reserve):

| Relation | Bytes/row including indexes | 500M, GB | 3B, GB |
| --- | --- | --- | --- |
| Target-root binding fence | 192 | 96 | 576 |
| Binding identity/head with recipient and role reverse indexes | 640 | 320 | 1,920 |
| Sealed terms revision with typical path | 384 | 192 | 1,152 |
| Private control event/receipt | 384 | 192 | 1,152 |
| Approved permission member | 224 | 112 | 672 |

Terms sizing assumes two short path segments. Eight 256-byte segments require
2,048 payload bytes plus array/tuple overhead; provision the maximum separately.
With B bindings, R term revisions per binding and P approved permissions per
revision, permission rows add B*R*P. Local following stores no frozen permission
members; terminal control events remain independently counted.

Selected paths require target/recipient candidate keysets, role-impact reverse
pages and exact terms/event/permission keys. Current grants must be bounded to
256 relevant binding candidates and use batched role/recipient probes; a broad
role snapshot per candidate would violate the intended hot-path query budget.
Historical list cursors and filtered rosters are separate from effective access.
Scope fences can serialize a hot root; cold/warm plans, hot roles, long histories,
lock hold time, WAL, sustained throughput and recovery remain native obligations.

Every newly admitted `access_scope` initializes its empty binding fence, adding one
row and its primary-key entry to the private registry allocation path. Include that
cost even when no binding is ever written. The earlier registry-only tuple/index
sample does not measure this additional relation. A failed scope allocation rolls
back its fence with the same transaction; immutable scope identities retain theirs.

Recipient-dependent binding terms add two UUIDs and two bigint values at maximum
(48 payload bytes), plus a partial membership/generation reverse index. Reserve
another 160 bytes per dependent revision including its index: 80 GB at 500M rows
and 480 GB at 3B rows, before the overheads above. Independent terms create no
reverse-index entry. Exact admission and Group-event FKs preserve historical
meaning without copying membership history. Binding writes add bounded tree,
membership and optional selection-set locks and exact current-selection probes;
live policy must batch those probes within the combined decision budget. These
are planning inputs, with native race, plan and workload qualification pending.

The positive-binding reader admits 64 target selections, 64 distinct recipient
scopes, 64 total direct Group selections across those scopes, 512 ancestry rows
and 256 matching bindings. This composed budget can reject work that fits each
scope separately; it does not silently omit recipients. A root/recipient-scope
partial index supports at most 65 ordered next-key seeks per target root when
discovering cross-scope recipients. Reserve 112 additional bytes per indexed active
member-set binding: 56 GB at 500M rows and 336 GB at 3B rows, before overheads.
The total configuration and retained history remain unbounded by these read limits.

Permission hydration reads each selected role definition and binding approval by
exact keys in batches; each member query returns at most 256 times the registered
permission vocabulary plus one exhaustion sentinel. Shared negative membership
fences add no persistent relation, but consume bounded transaction advisory locks.
One SQL function acquires up to 64 pair keys in canonical order. The composed
reader has additional statement/lock costs beyond the prior component samples;
the proposed twelve-statement and latency envelope is not qualified by its source
implementation. Native query plans, cold/warm and hot-root contention, wait/expiry,
revocation and combined workload measurements remain required in verification.

## Representation persistence

Inventory Entity control fences, grant heads, sealed terms, permission members and
control receipts separately. Planning bytes per row including indexes are 192,
1,216, 608, 224 and 384 respectively. At 500M rows those relations require 96, 608,
304, 112 and 192 GB; at 3B rows, 576, 3,648, 1,824, 672 and 1,152 GB, before bloat,
WAL, replicas, backups and reserve. Typical terms use two short path segments;
the maximum eight 256-byte segments require separate payload provisioning.

One grant retains one concrete optional parent revision in its head and reverse
index, plus the exact parent subject/admission/selection basis when dependent.
The head estimate includes 320 bytes for this basis and its subject/admission
reverse indexes; independent heads have no entries in these partial indexes.
It does not copy all ancestors. Each terms revision adds its own approved
permission rows; multiply by authored revision and permission counts. An admitted
Entity subject initializes one control fence, including before its first grant.
Public catalog Entities without subject admission do not allocate these fences.
Writes use an Entity-local exclusive fence, one control event, sealed terms for
create/narrow and a head advance. Revocation writes no descendant fan-out.

Terms retain their explicit target kind and optional concrete scope FK; the head
mirrors the selected target for current indexes. The terms estimate reserves
64 bytes for this target snapshot and alignment. All-scopes stores no per-resource
rows, while narrowing to a concrete scope updates only that grant's head/index
projection and terms. It never materializes the Entity's resource permission set.

Parent traversal reads at most nine identities to detect the eight-edge limit,
checks exact current revisions and probes declared admission/selection dependencies.
Parent locks include Group trees, enrollments and selection sets. Institutionally
independent grants do not query their historical issuer for liveness. Management
snapshots point-read exact terms and at most the registered permission count.
These are implementation bounds and storage estimates, not native performance or
recovery acceptance. Hot Entity controls, long retained revisions, erasure reverse
pages, expiry after waits and complete represented request paths remain to qualify.

Selected request loading admits 64 exact grant references and at most 256 distinct
grant/revision lineage entries. Traversal first visits at most nine parent rows per
selected grant, then rejects a union exceeding 256. Up to two concrete membership
bases per retained entry need tree/enrollment/selection fences. Selected permission
hydration is bounded by 64 times the registered vocabulary plus one sentinel.

The pure one-operation path evaluator admits 64 grant facts, 65 subject facts and
4,096 total member-set entries, with at most 64 loaded scopes per subject. After
bounded validation and permission clipping, graph traversal permits 32,768 edge/
recipient branch visits. Shortest certain/uncertain visits avoid exponential path
enumeration; each path uses at most eight edges. These bounds do not include native
subject-policy loading or qualify the combined SQL, latency or credential budget.
Independent path outcomes and post-wait dependency changes need native acceptance.

## Native subject policy

The subject-policy reader admits 256 registry subjects, at most 256 nonrevoked
action-relevant enforcement candidates per principal and 512 total. It rejects
overflow before making a positive decision. An account/kind/nonrevoked-row index adds an
estimated 112 bytes per indexed enforcement: 56 GB at 500M rows and 336 GB at 3B
rows before overheads. Expired but retained nonrevoked rows still consume the
candidate budget; retention/reconciliation and long-history plans must be qualified.

Account/Entity identity rows supply the negative policy fence without another
stored relation. Policy writes acquire those rows exclusively; request reads share
them and use new READ COMMITTED statements. The actual lock footprint, hot-account
contention and index scan buffers remain native verification obligations. Time
boundaries include future enforcement starts and suspension/enforcement expiry.

Current representation composition permits at most 65 graph subjects and 256
subject/recipient-scope probes across the selected graph, plus bounded parent
subject lifecycle reads. It refreshes time-sensitive subject and lineage state
after member-set waits. The current per-subject composition adds SQL statements
beyond the isolated readers; its twelve-statement/latency target remains unqualified
and must be measured and repaired before applicable capacity acceptance.

## Private identity preferences

Plan 640 bytes per main/client preference head including account, partial namespace, Entity
and client reverse indexes, and 576 bytes per private receipt including its primary
and operation-identity keys. Each family is 320/288 GB at 500M rows and 1,920/1,728 GB
at 3B rows, before bloat, WAL, backups, replicas and reserve. With A accounts and C
client overrides per account, heads scale as A*(1+C); receipts scale with actual
configuration changes rather than logins or resource writes.

A capture reads one account fence and at most two preference rows. A mutation writes
one receipt and one narrow head; competing changes serialize per target account.
No controller roster, consent or resource grant is copied. Erasure uses receipt
primary-key pages by preference and account/client head indexes, child before parent
in at most 500-row batches. Whole history scans and per-resource default copies are
not part of this protocol. Native capture/change/erasure races and plans remain
unqualified until verification.

## Private recipient selectors

Selectors add no persisted relation. Each token has at most 512 encoded characters
and at most five minutes of validity, with associated context capped at 8 KiB.
Each mint performs per-token HKDF and authenticated encryption; each resolution
authenticates before parsing the private payload. A 100-row page can add up to
50 KiB of encoded handles before presentation data. Bound endpoint admission and
measure mint/resolve cost at the declared roster rate before capacity acceptance.
The shared opaque-value owner also serves Collection continuations, whose own
4 KiB token cap and disclosure checks remain separate.

## Assignment ceilings

Each approval names one manager binding/terms revision and one assignable role,
with a bounded path and recipient policy. Plan 768 bytes for an approval head,
224 for each explicit permission member and 384 for each private control receipt,
including indexes. These families require 384/112/192 GB at 500M rows and
2,304/672/1,152 GB at 3B rows before bloat, WAL, replicas, backups and reserve.
Maximum target paths need separate payload provisioning. Replacements create new
approval identities; permission and control-event counts are not head counts.

The target binding fence protects negative approval reads and serializes creation/
revocation. A confer evaluation reads at most 256 approval candidates and bounded
permission members, with up to 64 recipient enrollment scopes. Scope-member probes
hold pair-local negative fences and exact membership rows without expanding rosters.
Actor/client/representation and assignment-impact work remain additional costs.
Native allowed/denied, source-revision, expiry, rejoin, activation and workload
qualification is deferred to the active scope's verification phase.

## First-party credential control

Each personal API key adds one retained control identity with principal reverse
lookup, version and terminal revocation. Plan 256 bytes per control row including
indexes: 128 GB at 500M rows and 768 GB at 3B rows, before operational overheads.
This is additional to the provider's removable secret/counter record. Counter
updates do not write the control head; configuration changes and deletion do.
No per-request history row is introduced by live credential checks.

Current personal-key reads use a control primary key and provider primary key;
session reads retain the session row. Permission/authority metadata is limited to
8 KiB per encoded field. Management effects additionally recheck exact source
versions and one selected representation path of at most eight edges, including
bounded Group ancestry and retained parent subjects. These SQL function/trigger
probes are real work even inside one application statement. Measure their query
plans, lock time, counter contention and total decision cost during verification.
