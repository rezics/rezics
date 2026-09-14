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
| Active token/credential metadata | 256-512 | 128-256 | 768-1536 |
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
The existing 256-512 bytes per active credential estimate remains 128-256 GB at
500M rows and 768-1536 GB at 3B rows, before retained revoked tokens, payloads, WAL,
replicas and reserve. The adapter fixture does not measure or accept that width.

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
