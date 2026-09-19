# Integrated model and addressing acceptance

Status: required scenarios for the selected 2026-09-19 target; **not executed**.
This document adds no passing gate. The [plan](../plan/README.md) selects runtime
scope and the [workflow](../plan/execution-workflow.md) controls test-authoring and
verification timing. Documentation maintenance does not start implementation.

Owners: [model contracts](../architecture/schema-modeling.md),
[standards](../architecture/standards-adoption.md),
[physical fields/families](../architecture/database/resource-storage.md),
[Space](../architecture/space-composition.md),
[addresses](../architecture/resource-addressing.md) and the existing native domain
contracts. Reuse source, identity, composition and graph harnesses; do not create
a second independent notion of acceptance.

## Vocabulary, source and exchange

| ID | Scenario | Required result |
| --- | --- | --- |
| MODEL01 | Reimport identical pinned artifacts and compiler/profile inputs | Stable definitions and deterministic output; no runtime dependence on current upstream bytes. |
| MODEL02 | Resolve and cache a definition; update labels/compatible revisions, retire the term, then switch API origin or registry identity epoch | Stable UUID across compatible updates; exact historical interpretation retained; mutable metadata revalidated and stale writes rejected under current admission. Mappings cannot leak across registry boundaries or silently rebind to another meaning. |
| MODEL03 | Unknown axiom/property/extension | Preserved or explicitly rejected under the profile; no silent loss or invented enforcement. |
| MODEL04 | Same triple in two named graphs; changed blank-node serialization | Graph boundaries and observation-scoped identity survive; selected canonicalization is reproducible, not native identity or truth. |
| MODEL05 | JSON-LD context unavailable, changed or outside admitted retrieval | Bounded pinned replay or explicit incomplete/rejected outcome; no uncontrolled context fetch. |
| MODEL06 | Qualified credit exported as a simple binary property | Concrete role/version/language/occurrence losses reported; preserved profile independently round-trips them. |
| MODEL07 | Previously unmapped Schema.org class including Recipe | Generic create/read/edit/query/export within its profile without new DDL or fabricated unrelated classification; specialized workflow remains separately qualified. |
| MODEL08 | Compare coverage before/after source or mapping update | Artifact, generic operation, native, query, validation, export and workflow evidence remain independent; unsupported fields are visible. |

## Language, values and references

| ID | Scenario | Required result |
| --- | --- | --- |
| MODEL09 | Valid content language absent from UI locale list | Native names/content preserve it; interface availability does not constrain storage. |
| MODEL10 | Two same-language names plus translation/transliteration | Separate occurrence/revision/source/role; no dictionary overwrite or identity merge. |
| MODEL11 | Missing requested translation and display fallback | Actual language/reason returned; no synthetic stored translation or false officialness. |
| MODEL12 | Missing language, `und`, `mul`, `zxx`, mixed direction and original spelling | Defined distinct states and safe round-trip under the language profile. |
| MODEL13 | Zero/false/empty, absent, unknown, no-value, invalid, unsupported and erased | Preserve declared distinctions and availability; no blanket conversion to null. |
| MODEL14 | Large integer, exact decimal and original scientific notation | No accidental JavaScript-number precision loss; comparison contract and lexical provenance explicit. |
| MODEL15 | Year-only, approximate, open interval and fictional calendar | Precision/reference system retained; no invented exact instant. |
| MODEL16 | Timezone gap/overlap and backdated correction | Explicit timezone/disambiguation policy; valid time and recorded time remain independent. |
| MODEL17 | Temperature versus difference, unspecified cup, incompatible quantity kinds | Only defined conversions; retain uncertain original values rather than infer density/unit system. |
| MODEL18 | Different CRS/axis order or fictional geometry | Native semantics preserved; GeoJSON conversion or unsupported result explicit. |
| MODEL19 | Unicode combining sequences/emoji/RTL selector across edits | Coordinate unit and exact revision retained; relocation is explicit, not latest-offset substitution. |
| MODEL20 | Conflicting source, valid signature, assessment and acceptance | Preserve each responsibility; no source rank/signature/confidence automatically becomes accepted fact or authority. |

## Grain, relationships and native operations

| ID | Scenario | Required result |
| --- | --- | --- |
| MODEL21 | Same performer with two characters and another voice language | Distinct qualified occurrences with exact version/role/order/evidence; no endpoint-pair deduplication. |
| MODEL22 | Same recording twice in one medium; same ingredient in two recipe groups | Separate occurrence/order and local credit/quantity, shared target identity. |
| MODEL23 | Add Recipe/Building classification and SKOS broader edge | No automatic DDL, logical-owner change, capability/permission grant or subclass entailment. |
| MODEL24 | Same external ID in different repositories; matching names/identifiers | Qualified references stay distinct; alignment and native merge are separately authorized decisions. |
| MODEL25 | Work/text/publication/copy, program/cut/listing/asset/encoding and project/package/build | Explicit grain maps; no fabricated parent or unqualified equivalence across standards/providers. |
| MODEL26 | Two Principals represent one public Agent; one Principal represents several Agents | No unique-account reverse lookup; public attribution and private accountability remain separate after revocation. |
| MODEL27 | Conflicting CAS writes, repeated operation key, stale source adoption | Deterministic conflict/replay; no duplicate effect or late overwrite. Shape validation alone is insufficient. |
| MODEL28 | Offline merge after authority revocation, when collaboration is activated | Mergeability does not admit a revoked publication/edit; unsynced/rejected/adopted states remain distinct. |

## Space and addresses

| ID | Scenario | Required result |
| --- | --- | --- |
| MODEL29 | One Space admits Realm/Zone capabilities; retire one | One identity, independent capability state/dependents; no implicit shared governance or deletion of the other capability. |
| MODEL30 | Two Spaces route to one Resource with Block content | No native ZonePage or content copy; shared renderer receives exact target/selection and typed presentation context. |
| MODEL31 | Same resource with different preferred slugs per Space | Scoped preferences and reverse links work; no target-wide canonical uniqueness. |
| MODEL32 | UUID-shaped slug, fixed root route, nested typed lookup and ambiguous patterns | Declared lookup mode, bounded resolver chain, reserved-route and activation-conflict checks; no string-shape guessing. |
| MODEL33 | NFC/case-policy collision, encoded separator and double encoding | Deterministic collision rejection; one decoding/serialization contract; policy upgrade does not silently rebind. |
| MODEL34 | Resolve a generated link under pinned context/versions; then rename/retire/revoke | Same Resource under stable preconditions; later redirect/gone/denied is explicit and preserves current disclosure. |
| MODEL35 | Concurrent slug assignment, rename, historical alias/tombstone and attempted reuse | Unique occupied namespace key, immutable generation/history and selected no-automatic-reuse policy; no redirect to another resource. |
| MODEL36 | Separate presentation/publication/governance/canon contexts; stale route execution | No authority inferred across roles; current target, route and accepted representation checked before body, metadata or query execution. |

## Storage, inverse reads and recovery

| ID | Scenario | Required result |
| --- | --- | --- |
| MODEL37 | Compact generic binary relation promoted to specialized storage; attempt repeated roles or n-ary participants in the compact layout | Logical decode equality, stable identity/revisions and equivalent allowed/rejected operations with one fenced writer; richer semantics use the identified association contract rather than opaque compact payloads. |
| MODEL38 | Same logical owner with new physical family; attempted true owner correction | Physical placement leaves references stable; actual owner/referent correction has explicit history and no silent grant retargeting. |
| MODEL39 | Invalid/multiple bridge target; proposed partitioned uniqueness; source-local versus inverse reads | Concrete FK and complete key rejection; per-target uniqueness proved after partitioning; inverse pages do not scatter over all source partitions. |
| MODEL40 | Known-definition subject lookups, skewed incoming/multi-role queries and search facets across specialized, compact-binary and identified-association relations; projection lag/rebuild, erasure and restored old events | Bounded work/current disclosure, visible freshness, idempotent replay and non-regressing revocation/erasure frontiers. Compare row/index/WAL, direct-read, projection, maintenance and restore costs at 500M/3B planning scales; no fixed query-cost ratio follows from stored bytes. |

For MODEL40, separate definition-resolution cache hits/misses from warm/cold
database caches. Record plans, scanned/returned rows, buffer work, p95/p99 and
ordering/keyset behavior for a book's authors and an author's works, including a
high-degree author. Known-UUID requests avoid repeated label resolution; participant
predicates stay correlated to one relation revision, and stable-definition queries
cover their admitted revisions. Measure writes by changed rows/indexes and WAL;
an accumulated history size is not an operation cost. These remain unexecuted
qualification cases, not performance evidence.

## Integrated qualification

The first vertical case is one generic Recipe with two same-language names and
another translation; repeated ingredient occurrences and uncertain quantities;
exact text and video fragments; distinct demonstration/voice credits; a measured
result and correction; two Space routes; dataset/export profiles; and a source
withdrawal that preserves independent human support. It must exercise the same
IR, references, native operations and loss reporting together.

Also retain book/translation/edition/copy, repeated music tracks, fictional canon,
software rebuild/package and shared-Agent authority cases. Do not infer those
grains or capabilities from the Recipe result.

For each executed case record fixture/input pins, logical/profile/binding versions,
tested code revision, tool/runtime versions, command, expected/actual outcome and
limits. Separate pure model checks, real PostgreSQL concurrency/constraint tests,
stateful API journeys, exchange reconstruction and representative load/recovery.
Rendered acceptance follows repository authorization boundaries. Small-fixture
correctness does not qualify corpus throughput, online migration duration or RTO.

The existing [2026-09-18 evidence](schema.md) remains valid for its named compiler
scope only. These scenarios are prospective acceptance, not an additional passing
result or an instruction to run application/browser work during documentation edits.
