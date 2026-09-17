# Schema and vocabulary storage

`@rezics/schema` is an independent Node/TypeScript workspace. It exports the
PostgreSQL **Drizzle schema**, a reproducible vocabulary importer, portable data
contracts, typed term UUIDs, and the persistence commands needed to exercise the
schema. No API server is required.

The physical schema is deliberately authored from the persistence invariants;
external vocabulary definitions generate **data and typed term constants**.
An upstream `creator` property is an identified term used by relation records.
Adding a term therefore requires an import, not a new SQL column or migration.
This is the selected predicate-as-data representation; applications may add
measured projections without changing its identity contract.

## Artifacts and commands

Run from the repository root:

```sh
task libraries:schema:sources:fetch
task libraries:schema:generate
task libraries:schema:inspect -- https://schema.org/creator zh-Hant
task libraries:schema:db:generate -- --name describe_the_change
```

The first command restores checksum-pinned upstream files. All compilation and
normal tests are offline. `registry/sources.lock.json` owns exact URLs, versions,
base IRIs, namespaces, byte counts, SHA-256 values and license references.
`registry/sources/` contains those unmodified inputs. `registry/bundle.json`,
`registry/profiles.json`, `registry/coverage.json`, `src/generated/terms.ts` and
`schemas/*.schema.json` are generated, never hand-edited.
Package Git attributes preserve upstream line endings and whitespace because
the source checksums cover their exact bytes, including OWL's CRLF input.

The initial inputs are Schema.org 30.1 **all terms**, SKOS Core, PROV-O, Web
Annotation, Dublin Core Terms/Type/Elements (2020-01-20), BIBFRAME **3.0.1**, and
the RDF/RDFS/OWL namespace files captured on 2026-09-17. The BIBFRAME artifact's
own version supersedes the earlier research's generic "BIBFRAME 2" description.
The compiler retains every parsed quad, including foreign-vocabulary assertions,
blank-node structures, lists, named graphs, deprecated definitions and unrecognized
axioms. Referenced XSD datatype IRIs retain their identity; this is not a complete
XSD lexical validator or an OWL reasoner.

An explicit PostgreSQL target is required for persistent operations:

```sh
export REZICS_SCHEMA_DATABASE_URL='postgresql://user:password@localhost:5432/schema_development'
task libraries:schema:db:migrate
task libraries:schema:import
task libraries:schema:select -- RELEASE_UUID 0
task libraries:schema:export -- /absolute/path/to/export
```

`import` verifies the entire bundle against its pinned inputs before an atomic
transaction. It stages all releases and installs the initial description profiles.
`select` uses an expected selection version: `0` means no previous selection.
The generated coverage file lists release IDs. Importing a newer release alone
does not adopt it. Export includes the selected releases and all original/context
bytes needed to reproduce them. `diff -- before.json after.json` reports additions,
removals, meaning changes and label changes separately; disappearance is not deletion.

## Drizzle integration

```ts
import { schemaTerm, schemaDefinition, defineRelationTables } from "@rezics/schema/drizzle";
import { terms } from "@rezics/schema/terms";

const mediaRelations = defineRelationTables("media");
const creatorId = terms.schemaorg.creator;
```

All tables use `public` and explicit snake_case column names. The standalone
migrator keeps its bookkeeping in `public.rezics_schema_migrations`. This package has its
own generated Drizzle migrations for standalone installation and qualification.
A service incorporating these exports into its existing Drizzle owner must generate
its own forward migration using that owner's workflow; do not replay two owners'
installation histories against the same tables. Existing `services/main` catalog
definitions still describe its older operational validation contracts; this package
does not silently replace those consumers or claim their acceptance.

`defineRelationTables(prefix)` produces a separate relation/revision/selection
family with the same logical record contract. Pass that family to the relation
commands. Install `relationIntegritySql(family)` with the consuming migration,
after the package's common integrity functions. The default family is `schema`.
Physical family names do not occur in logical addresses.

The schema separates:

| Responsibility | Persistence |
| --- | --- |
| Vocabulary identity, immutable release and selected release | `schema_vocabulary`, `schema_release`, `schema_vocabulary_head` |
| Stable term IRI/UUID and explicit aliases | `schema_term`, `schema_term_alias` |
| Exact upstream meaning and release membership | `schema_definition`, `schema_release_term` |
| Original multilingual label literals and their release membership | `schema_label`, `schema_release_label` |
| Independently adopted translations and their history | `schema_label_selection` |
| Product validation rules and exact term dependencies | `schema_profile`, `schema_profile_revision`, `schema_profile_rule` |
| Shared edit identity | `schema_change` |
| Addressable assertions, revisions, adoption and retraction | Each relation table family |

Immutable tables reject updates/deletes. Corrections append revisions; selections
append decisions. Foreign keys prevent attaching another term's definition or
another relation's revision. A revision parent must already exist in the same
relation, preventing cycles even in a multi-row insert. Latest revision is not
automatically the adopted revision. Translation selection has a separate per-locale
history and does not change definition IDs or existing relations.

Sources, reviews and AI annotations can be relations whose subject/target is an
edit, relation or exact revision. They share this mechanism; there is no duplicated
source-book/native-book model. A `LogicalReference` contains a stable logical owner,
UUID and optional revision UUID. Each owning service supplies endpoint existence,
capability, authorization and deletion policy through the reference validator;
this package cannot enforce remote existence with a PostgreSQL foreign key.

## Preservation and interpretation

Term IDs use RFC 9562 UUIDv5 in the fixed package namespace and the exact IRI.
This namespace and algorithm are part of portable format 1, never deployment
configuration. A detected collision/conflicting IRI rejects import. Only declared
Schema.org terms receive the documented HTTP-to-HTTPS identity alias; the retained
graph keeps its original IRIs. An alias cannot take over a previously assigned IRI
identity; such an upgrade fails for explicit resolution. `sameAs` and similar
statements do not merge entities.

RDFC-1.0 canonicalization gives order/blank-label-independent graph content digests.
Blank-node labels are scoped to their release and are not global object IDs.
Definition digests cover outgoing statements plus connected blank-node structures,
excluding the explicit display-label predicate set. Comments and other axioms remain
part of meaning. A definition's hash is not the closure of every inherited rule;
profiles pin exact definition revisions and vocabulary bundles preserve the full
dependency context.
Changes to the import interpretation/alias/projection algorithm require a new
compiler contract version and regenerated artifacts; changing implementation
must not silently reinterpret a published compiler version.

Native values preserve lexical strings and datatype IRIs, including integers beyond
JavaScript's safe range. Unknown, no-value and absence remain different. RDF 1.2
quoted/directional terms require a future explicit format; unsupported inputs fail.
JSON-LD uses pinned local context loading, strict value handling and compound-literal
direction encoding. Syntax discarded by RDF conversion is recoverable from the
original artifact; it is not silently invented as graph assertions. The convenient
label index covers literal labels. Resource/compound labels remain in the full graph
and are explicitly counted as `unindexedLabels`, not reported as indexed translations.
Audit timestamps use millisecond precision; external high-precision times remain
typed lexical values rather than passing through JavaScript `Date`.
Ordering positions are decimal strings in portable records and exact PostgreSQL
`numeric` values with integral/nonnegative/40-digit checks, so database ordering
does not become lexicographic or lose precision through JavaScript numbers.

Book, image, video, wiki, forum and message profiles are initial **description**
profiles. They demonstrate explicit value-kind/cardinality/order/definition rules.
They do not implement publishing policy, every media selector, message delivery,
OWL inference, datatype value-space validation or all domain APIs. Complete vocabulary
preservation is distinct from implementing every possible use of that vocabulary.

## Capacity and portability

Vocabulary compilation is bounded control-plane work: at most 128 selected inputs,
16 MiB per source, 64 MiB total source bytes and expanded representations, 250,000 combined quads, 50,000 referenced
terms, 10,000 quads per definition closure and bounded canonicalization work/time.
Budget overflow fails explicitly. These limits do not cap the content corpus.
The initial selection's measured cardinalities are in `registry/coverage.json`.

Relations and histories can be corpus-scale. For `N` relations and mean `R` retained
revisions, the model stores `N` identities, `N*R` revisions and the actual number
of adoption decisions. At the repository's 500M/3B local planning levels, `R=3`
means 1.5B/9B revision rows; a 1T relation scenario means 3T revision rows. None is a
measurement or a requirement to load those rows now. At a hypothetical 300 bytes
per revision **before** indexes/WAL/replicas, those are 450 GB/2.7 TB/900 TB.
Large literal payloads increase this; binary media belongs in asset storage.

Each revision writes a primary key, relation/revision uniqueness key, history index,
predicate index and, for reference values, reverse-target index. Imported definition
IDs are small replicated metadata, not a synchronous central allocator. UUIDs can
be created before any parent write. Current selection lookup uses `(relation_id,
version DESC)`; history uses `(relation_id, created_at, id)`; subject lookup uses
`(subject_owner, subject_id, id)`. Global traversal/counting is not a constant-cost
promise. Serving-current projections and reverse indexes should be owned by measured
queries, with explicit consistency when replicated.

Start on one PostgreSQL database. Split physical relation families by workload,
then route logical owners/IDs to databases while copying the small term/profile
dictionary with unchanged IDs. An immutable revision is portable JSON, not a table
OID or sequence value. A backend replacement must preserve atomic writes, revision
immutability, reference validation, idempotent receipts and selection CAS; a KV
`get/put` interface alone is insufficient. Cross-shard uniqueness/invariants and
hot subjects may require coordination or specific placement. PostgreSQL partitioning
alone is not horizontal scaling. The package tests establish bounded representation
and PostgreSQL correctness, not production trillion-row throughput or online cutover.

## Evidence

Primary sources reviewed September 2026:

- [Schema.org artifacts](https://schema.org/docs/developers.html) and [data model](https://schema.org/docs/datamodel.html): complete definitions, multiple inheritance, suggested ranges and collection semantics.
- [SKOS](https://www.w3.org/TR/skos-reference/), [PROV-O](https://www.w3.org/TR/prov-o/) and [Web Annotation](https://www.w3.org/TR/annotation-vocab/): classification, provenance and exact-target annotation vocabularies.
- [DCMI machine files](https://www.dublincore.org/schemas/rdfs/) and [BIBFRAME source](https://github.com/lcnetdev/bibframe-ontology): pinned vocabulary inputs, not automatic REZICS business rules.
- [RDF Dataset Canonicalization](https://www.w3.org/TR/rdf-canon/) and [rdf-canonize](https://github.com/digitalbazaar/rdf-canonize): graph comparison and bounded blank-node processing.
- [rdf-parse](https://github.com/rubensworks/rdf-parse.js): existing syntax parsers; REZICS owns identity, release and adoption semantics.
- [UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html) and [PostgreSQL partitioning](https://www.postgresql.org/docs/18/ddl-partitioning.html): stable identifiers and actual partition constraints.

Upstream vocabulary artifacts retain their original notices and the licenses
linked in the source manifest; package implementation code uses the repository license.

## Verified scope

Verified on 2026-09-18 with Node 26.8.2 and PostgreSQL 18.6:

| Command | Result |
| --- | --- |
| `task libraries:schema:typecheck` | Passed with the repository's TypeScript configuration. |
| `task libraries:schema:test` | 12 tests passed, including reconstruction of every pinned input, blank-node/list/named-graph preservation, language and exact numeric values, translation/meaning separation, pinned contexts, malformed inputs and resource budgets. |
| `task libraries:schema:db:test` | 16 scenarios passed on a newly created PostgreSQL cluster, including migration replay/drift, full import/retry/export, selection concurrency, 40-language translation history, exact revision evidence, numeric ordering, rejected foreign keys/cycles/corrupt bytes, atomic rollback, and transfer to another database and physical relation family. |

The selected inputs contain **25,265 retained quads**, **4,468 distinct term/reference
identities**, and zero unindexed labels. These are measured vocabulary counts, not
content-corpus capacity results. PostgreSQL tests stop and remove only their own
cluster under repository `.temp/`. They never reset an existing development database.

This qualifies the standalone package's selected schema/import/persistence contracts.
It does not qualify existing main-service consumers, complete HTTP APIs, arbitrary
domain profiles, distributed transactions, online migration, or production capacity.
