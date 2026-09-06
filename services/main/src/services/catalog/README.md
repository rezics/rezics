# Native catalog storage

This module implements the first native storage foundation of the
[source-complete schema program](../../../../../docs/plan/operational-refactor-20260906/00-source-complete-schema.md).
It is not the completed four-source model or the global Unit cutover. Public
routes, shared Access integration, full revision/restore semantics, complete source adapters,
complete domain/source coverage and legacy conversion still have separate outstanding work.

## Implemented boundary

- Publishing, music, program, software, Entity, grouping and reference owners have
  separate physical identity tables. Their UUIDs are not foreign keys to `unit`.
  A rebuildable locator contains routing only and is not a foreign-key parent.
- Native references are internal owner/ID contracts. Public kinds, semantic classes
  and storage owners must not be equated when integrating the existing API.
- Names, plural identifier claims, typed facts, value nodes, relation participants,
  qualifier bindings, source support and operation records have owner tables.
  Object-owned growing rows carry the object ID in their primary/foreign keys.
- Relation participants have one populated concrete target FK. Predicates, roles,
  classes and property meanings reference definition revisions; wrong definition
  kinds are rejected by PostgreSQL. Complete predicate-shape/cardinality governance
  is not yet implemented.
- Value nodes preserve array order, repeated Infobox entries, nested containers,
  null/false and fractional values. Append commands accept at most 512 nodes and
  512,000 serialized bytes; the fact can span arbitrarily many admitted batches
  within the exact-integer position range. Sealing checks the current prefix and
  declared root value kind. General editing and historical restoration remain open.
- Database guards reject mutation/append of sealed values, reopening a sealed
  header and changing source snapshots. Erasing value nodes requires a withdrawn
  fact; complete source-withdrawal and historical recovery workflows remain open.
- Grouping class assignments and independent order profiles distinguish universe,
  franchise, series and continuity without a table or hardcoded SQL enum per class.
  Current commands do not copy permissions, reviews or progress to members.

Call commands inside a transaction. Propagate failures to rollback, or use a
savepoint when grouping commands and deliberately handling a rejected operation.
The supplied actor is the authenticated private Auth user, not a catalog author.
Current native writes require that actor to be the identity's creator. These
internal commands must not be exposed as the completed shared authorization API.
Read paths filter drafts, removed objects and private targets; participant
conjunctions correlate to the same owner and relation ID.

During conversion, a temporary legacy insert guard and native insert guard share
an ID-scoped transaction lock. They reject concurrent ownership conflicts without
rewriting old IDs. P11 must remove the legacy guard and all remaining global-parent
dependencies before marking the final identity gate complete.

## Typed domain structures

The next slice adds 50 tables for publishing Work/text/publication/serialization,
music Work/Recording/Release Group/Release/Medium/Track, shared artist credits,
alternate tracklists, TOCs and scoped child identifiers, program/season/version/
episode occurrences, VN content/releases/local editions, Entity profiles and
Area/Place/Event/Instrument metadata. Structural subtypes have an ID/shape FK to
the correct owner, so a Work cannot accidentally acquire Recording storage.
Dates preserve separate year/month/day components and original text. Release
events can have distinct or unknown territories. These tables do not constitute
a complete provider mapping or a migration of old catalog consumers.

Artist credits use begin/append/seal commands. Each append admits at most 128
members and 512 KB; total membership is not limited to one batch. Statement-level
transition tables maintain prefix counters, and only sealed active groups may
be referenced. Original credited names/join phrases and source positions are
preserved. Database guards prevent later mutation; a retired group permits
controlled value erasure. Original group size remains historical after erasure.

Publishing installment parents are checked within their serialization, under an
owner lock, with at most 256 ancestor steps. Display order is separate from
parentage and source numbering. This is a declared hierarchy-grammar limit, not
a cap on the number of chapters in a serialization. Deep imports fail explicitly.

For capacity planning, budget subtype rows, occurrences, alternate presentations,
credits and indexes separately. An illustrative track occurrence at 160 B heap
plus 320 B across primary, position, medium-scope, recording and credit indexes
is 240 GB at 500M tracks and 1.44 TB at 3B tracks before TOAST/WAL/replicas. Four
occurrences per recording multiply those costs by four at the same recording
population. Shared credits and TOCs have their own aggregate/routing key; they
are not empty social identities. Measure hot serialization/credit locks and
source fan-out before qualification. Domain command tests are correctness
evidence, not measured 500M/3B throughput or cross-database FK support.

## Source contract inventory

`source-contracts/artifacts.json` pins upstream locations and byte checksums.
`source-contracts/fields.jsonl` is generated by
`scripts/generate-catalog-source-inventory.ts`. It enumerates declarations from
Bangumi OpenAPI/components/Archive/common, VNDB Kana, MusicBrainz SQL/key contracts
and pinned Open Library type files without executing upstream code.

The inventory includes source-private/operational declarations and vocabulary
structure. Its row total is **not** catalog coverage or the required mapping
denominator. Each retained catalog contract still needs an explicit field
disposition, owner mapping, conversion and native conformance case; account,
credential and private-collection structures must not become imported Auth data.

From `services/main`, regenerate or verify with a cache under repository `.temp`:

```sh
yarn exec tsx scripts/generate-catalog-source-inventory.ts ../../.temp/catalog-source-cache --fetch --check
```

Pinned Git sources are reproducible. The VNDB schema URL is mutable: a changed
checksum requires a reviewed baseline update, not silent acceptance of a new
contract. The current parser preserves unknown scalar shape information as
unknown rather than guessing types from field names. Source API validation and
the native mapper remain distinct tasks.

## Source observation and initial adoption

Initial adapters now accept Bangumi Subject, Open Library Work/Edition, VNDB VN
and MusicBrainz Release records against pinned contracts. Acquisition writes an
8 MB maximum record to an archive port before the database transaction. The
receipt binds the source key, contract hash and exact content hash. A mapper
cannot substitute another payload or fabricate an inline reference's snapshot
evidence. Inline MusicBrainz identities are checked against the actual JSON
Pointer value in the recorded document, including escaped keys and exact array
indices ([RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)).

First adoption creates private identities. Repeat observations reuse the source
binding; changed observations create a review proposal without replacing human
edits. An inline reference can establish identity using another record's snapshot;
fetching its own record later requires review rather than a second identity.
Proposal application/rejection, withdrawal, durable dependency scheduling and
complete historical recovery still require implementation.

The initial native projections are deliberately reported separately from source
preservation:

| Input | Structural projection verified | Supplied fields still requiring semantic mapping |
| --- | --- | --- |
| Bangumi Subject 253 | Program identity, independent main/total counts, identified original/Chinese names and source binding | Episode/person/character graphs, governed tags, indices, revisions and Archive-only catalog relations |
| Open Library Work/Edition | Work, publication, direct publication-to-Work coverage, page metadata, plural identifiers, publisher/date events | Author and classification identities/relations, complete book contracts and serialization/translation cases |
| VNDB VN v17 | VN content, scoped local editions, names/languages and source identifiers | Staff/alias/voice graphs, edition-qualified relationships, releases, characters and taxonomies |
| MusicBrainz Release | Release group, release, media, distinct track occurrences/recordings, sealed artist credits and source-backed artist references | Ancillary musical/reference objects, complete relationships/attributes, vocabularies, TOCs and redirects |

Every supplied field in these examples also has ordered typed value nodes with
snapshot support. The source export reconstructs those observations from native
rows rather than loading the archive. This establishes lossless observation
storage; it does **not** prove all fields have canonical domain semantics or that
a canonical human edit is reflected in source-shaped exports. Some structural
projection writes remain adapter-specific; unifying them with the source-free
domain commands is still part of the canonical-path gate.

Acquisition and source export limits apply per admitted record, not per owner or
corpus. Export reads 512 nodes per keyset page with a 200,000-node/32 MB
materialization budget. Import value batches keep the existing 512-node/512 KB
limit. The initial adapters do not yet offer staged recovery for a source record
larger than these budgets; they fail explicitly. Large dependency fan-out,
transaction duration, source hot keys and per-reference query counts remain
capacity work. Never qualify these paths using only the small live examples.

Snapshots, mapping claims and review proposals are growing source-record-keyed
families. At an illustrative 160 B heap plus 192 B indexes, 500M proposals cost
176 GB and 3B cost 1.056 TB, excluding WAL, replicas and retained payloads. Three
observations per 500M/3B source records produce 1.5B/9B snapshots; at an assumed
400 B per header/index total this is 600 GB/3.6 TB, with object bytes budgeted
separately. These are planning estimates, not measured widths. Queue workers
still need bounded claim batches, retry admission and retention; the pending
index alone does not implement an operational queue.

Local live-response checks use real `rezics-dev` PostgreSQL and rollback their
rows. The archive port is an in-memory test double in these checks. The default
storage adapter, private bucket policy, rights controls and archive recovery are
not qualified by them; `Cache-Control: private` is not a bucket access policy.

From the repository root:

```sh
task services-main:catalog:check-source-local
task services-main:catalog:check-books-local
task services-main:catalog:check-vndb-local
task services-main:catalog:check-music-local
```

## Workload and capacity boundaries

Use N = 500M logical identities and N = 3B for the capacity estimate. Illustrative
rich-catalog fan-out is 8 names, 12 long-tail facts, 6 value nodes per fact, 20
relations and 3 participants per relation. Those are planning inputs, not measured
corpus distributions. The value-node family would therefore have 72N rows:
36B at the baseline and 216B at the larger estimate.

| Family | Illustrative heap + indexes per row | At 500M rows of that family | At 3B rows of that family |
| --- | ---: | ---: | ---: |
| Owner identity | 200 + 160 B | 180 GB | 1.08 TB |
| Locator | 64 + 48 B | 56 GB | 336 GB |
| Named form | 180 + 160 B | 170 GB | 1.02 TB |
| Fact header | 144 + 144 B | 144 GB | 864 GB |
| Value node | 176 + 192 B | 184 GB | 1.104 TB |
| Relation participant | 176 + 192 B | 184 GB | 1.104 TB |
| Evidence support | 176 + 224 B | 200 GB | 1.2 TB |

Decimal sizes exclude long text/TOAST, dead tuples, WAL, replication, backups and
history. Multiply each family by its actual fan-out; for example 72N value nodes
at the illustrative 368 B total cost 13.248 TB at N=500M and 79.488 TB at N=3B.
Seven nullable target alternatives do not store seven UUID payloads per
participant: exactly one is populated, with only its partial reverse index.
Account for primary, position, role and target indexes separately in measurements.

Qualification starts with 100 reads/s, 20 writes/s, 32 clients and a 5x burst, plus
1M-member hot owners. Identity creation additionally takes one UUID-scoped advisory
lock and updates the locator; batches and concurrency must fit PostgreSQL's lock
budget. Ordinary metadata changes do not update routing. Name/fact/relation reads
use owner keys and keyset pages; value export is paged. Predicate queries must
measure selective and popular targets with visibility filtering enabled.

This foundation is **not capacity-qualified**. Before acceptance, replace width
estimates with samples; measure cold/warm p95/p99, buffers, WAL, index write
amplification, lock waits and admitted/rejected work. Object-owned families can
partition on their existing owner key without losing composite FK scope. Source
snapshots use the source-record key. Locator and source/definition uniqueness,
cross-owner reverse projections and cross-database reference conversion require
their own routing/cutover evidence; a single global unique index is not a sharding
plan. Rebuilds need checkpoints and admission fencing, not recurring full scans.
Keep the P10 disk/IO/recovery-reserve thresholds and do not extrapolate a small
local fixture into a 500M/3B deployment claim.

## Local verification

Generate and check migrations through the repository tasks. Use `rezics-dev` and
its `psql` for local inspection. `scripts/check-catalog-native-foundation.ts`
requires an explicit disposable-fixture flag and a loopback `/rezics` URL. It runs
canonical command/read checks in a rolled-back transaction, then removes the
exact private identity used for the independent concurrency check.

This verification establishes the named storage/service behaviors only. It does
not qualify source completeness, a whole-database cutover or rendered UI behavior.
