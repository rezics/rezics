# Resource fields and physical storage families

Status: selected model/field boundaries, 2026-09-19; concrete layouts and capacity
remain unqualified. [Schema modeling](../schema-modeling.md) owns meaning and
[the dictionary](data-dictionary.md) owns detailed relational contracts.

## Deployment and identity boundary

Use one PostgreSQL database and the `public` schema. This selection separates
tables and access paths; it does not activate multiple databases, distributed
transactions, remote-reference protocols or a new storage engine. Large payloads
retain the existing object-storage boundary.

A storage family is an engineering grouping documented here and represented in
StorageBinding. It is not a semantic class, a Resource, an authenticated subject,
or a mandatory `storage_family` string on every row. Stable logical owners and
IDs survive physical specialization. Domain identity anchors may remain local to
their owner while payload/index layouts change; no global Resource parent is added.

An owner admission/specialization must prove one authoritative identity for a
logical owner/ID, concrete reference validity and fenced writer selection. A routing
projection is not the existence authority. Do not silently reinterpret an existing
owner key merely because a target table was renamed. In particular, the existing
people-oriented `entity` implementation must be explicitly reconciled with the
selected Agent and generic Entity responsibilities before affected consumers switch.

## Subject responsibilities

| Responsibility | Selected physical direction | Grain guard |
| --- | --- | --- |
| Publishing | Owner-local identity and typed work/text/publication/copy structures | No forced universal Edition or fabricated Work parent. |
| Music | Owner-local identity plus composition, recording, release, medium and track occurrence structures | Repeated recordings/credits retain occurrence identity. |
| Program | Audiovisual work, season/episode, version/cut and occurrence structures | A program/cut is not a downloaded video or platform listing. |
| Software | Project/game, variants, builds, releases, packages and dependencies | Package/version strings, repository URLs and digests do not collapse grains. |
| Agent | `agent_identity` for described person/organization subjects and applicable agent structures | Public participation/control is separate; no private account parent or one-account assumption. |
| Generic Entity | `entity_identity` for a Resource without mandatory specialized structure | May have zero/multiple classifications; Recipe/Building specialization need not change its logical owner. |
| Indexed media | Separate `indexed_video`, `indexed_image`, `indexed_audio` physical families with their child data and an explicit stable-owner binding | Existing `indexed_media` logical references must not acquire physical table names. Preserve distinct platform video/audio publication identities when their referents differ. |
| Space | Shared `space` identity with separate capability/configuration, governance and route structures | Realm and Zone are composable product capabilities, not exclusive storage-derived classifications. |
| Other existing owners | Retain grouping, distribution, Document, publication/post, message, collection, access and operations owners | Every current owner needs a disposition; this table is not authorization to drop omitted modules. |

## Physical field policy

Dynamic properties also use physical typed columns. The distinction is whether
each new semantic property needs its own column, not whether its values have
structure. Each logical field has one authoritative binding; search/effective
copies are explicit projections.

| Storage responsibility | Retained physical fields or structures |
| --- | --- |
| Owner identity/control | `id`, owner-specific lifecycle state, local `control_revision`, creation/control-update and deletion times; applicable visibility/moderation and policy references. Do not force every owner into one publication state machine. |
| Names/localized text | Owner/reference key, name/value occurrence ID and revision, language, direction where supplied, text, role/property definition, source/derivation/context and selected-display state. |
| Typed fact | Owner key, assertion ID/revision, property meaning revision, value state, constrained typed value, context/validity and evidence/acceptance references. Exact numbers and lexical evidence survive encoding. |
| Relation | Home key, relation occurrence ID, current revision pointer; immutable definition/context/state revisions, participants, role definitions, exact targets, positions and typed qualifiers. |
| Strong structure | Complete concrete parent/child/revision FKs, occurrence identity/order, uniqueness and activation/seal state for releases, content structures, tracks, packages and other actual domain invariants. |
| Content | Document/variant/revision keys, format contract, payload/manifest, branch and published/adopted selection. Block positions do not become global identities. |
| Media representation/location | Exact asset/representation keys, byte length/digest, MIME/codec, dimensions, ticks/time scale and availability where admitted; URL/provider locator and observation remain separately identified. |
| Space/routing | Space/capability/control keys; membership/policy state; route identity/revision, normalized pattern/typed parameters, target binding and address-namespace/preference keys. |
| Operations | Idempotency identity/digest, current fences, lease/attempt/retry state, receipts, outbox, checkpoints and private audit attribution. |
| Derived queries | Explicit source revision/generation, comparison/order keys, freshness and rebuild/checkpoint state; no independent fact writer. |

Names, descriptions, semantic classes, gender/birthplace/biographical dates and
creator/performer/publisher claims do not become mandatory identity columns.
Use their name, fact or contribution contracts. IdentifierAssignment owns ISBN,
provider keys and other namespace-qualified claims; syntax checks do not establish
unique assignment. A known encoding's technical duration is distinct from a source
claim about a work's running time. Publication dates belong to the actual event/grain.

Keep structural discriminators such as value-kind, fixed/UUID/slug target mode,
and payload availability. A semantic Tag cannot replace them. Private
`created_by_auth_user_id` may remain where an actual private audit invariant needs
it, but is not public authorship, ownership or universal domain authorization.
Independent name/fact/relation edits advance their own heads, not one root counter.

## Shared templates and growth isolation

| Family | Intended contents |
| --- | --- |
| catalog | Shared low-frequency descriptive names/facts/relations for publishing, music, program, software, Agents, generic entities, grouping and distribution, where access/lifecycle requirements fit. |
| video | Indexed-video names/facts/relations and related high-volume intake/metadata paths. |
| image | Indexed-image names/facts/relations and image-specific intake/metadata paths. |
| audio | Indexed-audio names/facts/relations and audio-specific intake/metadata paths. |
| community | General semantic relations for posts/Wiki/Space/content; dedicated interaction and operational tables retain their own invariants. |

These are initial physical groupings, not a fixed total number of tables or a claim
that all members have identical workload. Typed domain structures and high-frequency
reactions, membership, delivery, leases and counters are not forced into generic
relations. Within one family, value kind, retention, hot-key isolation and query
shape can justify separate physical tables without creating new logical owners.

The reusable relation template includes head, immutable revision, participant and
qualifier roles. A simple fact, name or strong structural link need not materialize
all four. The earlier five-families-times-four-tables count was a candidate template,
not complete DDL. Evidence/history/acceptance and domain structures have additional
owners. Adding an ontology class or a new relation definition does not create a
table for every class or every pair of endpoint types.

Use three physical relationship strategies behind the same logical definition
contract. Selecting a definition does not by itself select the largest layout.

| Physical strategy | Admit when | Required boundary |
| --- | --- | --- |
| Specialized structural relation | Stable meaning/cardinality, high volume or hot reads/writes justify dedicated typed columns and concrete FKs | The table owns its invariant and transaction; logical definition/occurrence identity remains stable across placement changes. |
| Compact generic binary edge | A long-tail relation is binary and current-oriented, has no repeated participant role and does not need an independently revised relation node | Store typed source/target references, exact definition revision, context/state and admitted typed qualifiers in one occurrence row. Keep source/predicate and target/predicate access paths; do not emulate n-ary or historical semantics with opaque payloads. |
| Identified association | The relation is n-ary, repeats roles, has independent identity/history, valid-time/context, ordered participants, qualifiers, evidence or acceptance | Use the head/revision/participant/qualifier contract and correlate every participant predicate to the same exact relation revision. |

API and TS declarations expose one logical relation definition and its admitted
operations; they do not expose a physical table name. A definition can be promoted
from a compact edge to a specialized relation after measured volume, skew or access
cost justifies it. Promotion preserves meaning, occurrence identity, order, exact
references and allowed/rejected operations, builds and reconciles the replacement,
then fences the old writer before authority switches. It does not leave two editable
authorities or require a table for every ontology term.

Search and facet requests consume a flattened, generation-bound projection of
accepted visible values and relationships. They do not perform foreground joins
over arbitrary canonical association tables. Schema-driven attribute requirements
and dynamic filter presentation are useful catalog precedents, but public seller
schemas do not reveal a retailer's canonical storage or establish generic-relation
performance; the evidence boundary is recorded in [design evidence](design-evidence.md#composition-and-system-operations).

Choose the relationship home by its declared edit/transaction scope: a video's
credit is video-owned even when its performer is an Agent. Each occurrence has one
authoritative home; symmetric and cross-domain definitions must also specify one.
Definition labels use bounded vocabulary/name metadata. Corpus names and localized
text follow their owning family, using one logical language/value contract.

## References and inverse reads

Use direct FKs for known structural targets. Generic participants use the
[reference-value contract](README.md#32-generic-references-without-a-universal-entity-parent):
exactly one concrete target, immutable binding, restricted target deletion and
complete revision/occurrence keys when needed. Cross-table FKs remain available
inside the selected single database. An unchecked `(kind,id)` is not equivalent.

Keep the currently selected bridge unpartitioned until a replacement key/constraint
design is qualified. One candidate uses `(logical_target_owner,target_id)` as both
the canonical reference key and hash partition key, with database checks proving
agreement with the selected concrete FK. That is a new bridge contract, not a
partition clause that can be applied to the existing surrogate-ID schema. A
surrogate-reference-ID hash does not by itself retain global per-target uniqueness.

Subject-local partitioning does not make target-only queries local. A bounded,
rebuildable incoming-relation projection is organized by target, predicate and
stable continuation key and points to authoritative relation revisions/homes.
Declare whether maintenance is synchronous or outbox-driven, expose freshness and
recheck current membership/disclosure. Never scan every owner/partition to answer
one actor's incoming page, update one popular actor row for every credit, or use a
stale reverse entry to establish current authority. Extreme target degree needs
an explicit bounded bucket/merge plan if target-local indexing stops meeting budget.

## Capacity and replacement evidence

Retain the [500M/3B-row policy](../data-integrity-and-workload-budgets.md#capacity-planning)
for each growing relation. Distinguish objects, physical rows, bytes and requests
per second. Names, participants, source observations, revisions, evidence and
incoming projections multiply independently. Existing [capacity scenarios](capacity.md)
are estimates for their recorded layouts; do not silently reuse them for this target.

The generated [relationship comparison](capacity.md#specialized-and-generic-relationship-comparison)
currently gives these planning envelopes for native heap plus indexes:

- a generic current binary association is 1,152 bytes, or 3.27x one 352-byte
  specialized current occurrence;
- a generic versioned binary association is 1,624 bytes, or 2.21x the 736-byte
  specialized versioned proxy with the same 1.5-revision assumption; and
- the catalog's 1.5-revision, three-participant association profile is 2,128
  bytes, or 2.89x that versioned binary proxy and 6.05x the less capable current
  specialized row.

These ratios are arithmetic over planning widths, not PostgreSQL measurements.
Use 2-3x as the initial like-for-like storage envelope and 3-6x when comparing the
full identified association with a minimal current relation. The recorded rows and
bytes support only an initial 2-5x write-work and 2-4x bounded direct-read-work
hypothesis. Candidate DDL must measure physical bytes, WAL, p95/p99, buffer work,
vacuum/freeze and skew before activation. The compact binary edge has a qualification
target of at most 2x the specialized current occurrence for its admitted workload;
its actual estimate waits for candidate columns and indexes.

No fixed 32/64/128/256 partition count is selected. Measure row/index widths, tail
sizes, degree/skew, query pruning, p95/p99, write amplification/WAL, vacuum/freeze,
rebuild, backup/restore and hot-key contention. Tables in one database still share
CPU, I/O and WAL. Model current heads separately from append-only history/intake;
time-based retention is not permission to erase permanent referenced history.

Each binding declares subject and reverse queries, page/scan/fan-out budgets,
maintenance/retention cost, limiting resource, observable thresholds and a concrete
same-database partition/specialization/archive response. Any later database split
requires its own activation and reference/recovery protocol. No trillion-scale
throughput or 3B-object deployment has been qualified by these declarations.

Before physical promotion, compare old/new logical reads and legal/rejected
operations, preserving names/languages, exact values, duplicate participants,
order, scope, evidence, history, erasure and reference validity. Fence the old writer
before activating the new authority; a rebuildable projection is never a second
editable source. Fresh development/test rebuilds are allowed by the program;
no legacy transfer or online dual-write is required solely for compatibility.

Primary engineering evidence: [TAO](https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf)
demonstrates shared object/association storage with workload-specific separation;
[Schism](https://www.vldb.org/pvldb/vol3/R04.pdf) studies workload-driven placement;
[PostgreSQL partitioning](https://www.postgresql.org/docs/18/ddl-partitioning.html)
specifies pruning, uniqueness and planning constraints. None qualifies this
composition or selects its partition count. [Acceptance](../../testing/model-contracts.md)
remains unexecuted.
