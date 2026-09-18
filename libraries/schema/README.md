# Complete REZICS schema

`@rezics/schema` owns the production PostgreSQL **Drizzle declarations** for all
REZICS domains. `services/main` imports these declarations directly; there is no
second copy or compatibility schema. The [generated table catalogue](docs/tables/README.md)
lists every table, column, primary/foreign key, index and check constraint. The
machine-readable equivalent is [schema-catalogue.generated.json](schema-catalogue.generated.json).
A table count is an inventory, not proof of product or capacity acceptance.

## Organization

| Owner | Responsibility |
| --- | --- |
| `src/postgres/{domain}/*.ts` | Actual domain-specific Drizzle declarations; `index.ts` files are public entry points. |
| `src/postgres/vocabulary/` | Terms, labels, immutable meaning/release membership, full RDF nodes/statements and converted provider contracts. |
| `src/postgres/knowledge/` | Identified semantic relations, descriptions for classes without a native owner, typed values, evidence and assessments. |
| `src/postgres/catalog/`, `publishing/`, `music/`, `audiovisual/`, `software/` | Native identities, Works/versions/releases, credits, structures and domain constraints. |
| `src/postgres/media/` | Indexed media, observed URLs, page occurrences, representations, blobs, streams/fragments, metadata and bounded presentation selections. |
| `src/postgres/forum/`, `messaging/`, `wiki/` | Separate identities, hot writes, revision/payload lifecycles and query locality. |
| `src/postgres/identity/`, `access/`, `integrations/`, `realms/`, `community/`, `governance/`, `commerce/` | Accounts, participation, authorization, applications, realm policy, subscriptions and entitlements. |
| `src/postgres/ingestion/`, `history/`, `documents/`, `discovery/`, `operations/` | Observations/adoption, edit references, payloads, rebuildable search/recommendations and durable operations. |
| `src/contracts/` | Portable values and pure native contracts. This library never imports application services. |
| `src/bindings.ts`, `src/profiles.ts` | Explicit native storage dispositions and every selected Schema.org class's inherited description properties. |
| [`../schema-importer`](../schema-importer/README.md) | Source-specific conversion, pinned input bytes, compiled artifacts and database import/export commands. |

`postgres` names the physical backend. Files name the domain and responsibility,
for example `media/indexing.ts` and `wiki/pages.ts`; neither a giant `drizzle.ts`
nor one file per upstream property helps ownership. Drizzle permits schema files
and directories; no special filename is required ([official declarations](https://orm.drizzle.team/docs/sql-schema-declaration)).
`drizzle.config.ts` remains the tool's conventional configuration filename.

## What conversion means

The importer compiles complete pinned **vocabulary and source declarations** into
queryable data held by the actual Drizzle tables. Schema.org classes are not SQL
tables and upstream properties do not automatically become native columns. That
would incorrectly treat multiple inheritance, open ranges and descriptive
properties as REZICS's cardinality/authorization rules. Drizzle domain tables are
authored for the selected invariants; the converter generates definitions,
UUID constants, inherited profiles and explicit storage dispositions. Both layers
are part of the delivered schema. This is not a JSON blob standing in for a schema.

A book author credit uses an identified relation and role/predicate definition;
there is no universal `book.creator` singleton column. Operational ownership,
revision, position and domain-required joins remain concrete columns and FKs.
For example, `media_metadata_revision.creator_entity_id` attributes the metadata
revision to its editor; authorship of the indexed media uses identified credits.
`schema_relation` is the open semantic relation family; domain credit/structure
owners remain the sole authority for their operational facts. A storage binding
is an explicit mapping, never automatic dual-write. Source-specific concepts that
cannot be mapped retain their queryable source declarations and unknown facets.

The full RDF graph retains blank nodes, lists, named graphs, original predicate
IRIs and unknown axioms in `schema_node`/`schema_statement`, with outgoing and
reverse indexes. Labels have independent meaning/translation revisions. A source,
review or AI annotation can target the exact edit/assertion/revision; a reference
to a source book does not require a duplicated native book.

## Identity and physical ownership

Objects create UUIDs locally before persistence. A message, wiki page or indexed
image does not insert a universal Unit/Work/Thing parent. The lazy
`reference_value` directory is used only when something needs a concrete referenced
object; it is not the content allocation path. New semantic/media/wiki references
do not automatically receive old Unit capabilities. References and authorization
are separate contracts.

Owned namespaces use the only REZICS domain, `rezics.com`:

| Meaning | URI prefix |
| --- | --- |
| Object identity | `https://rezics.com/id/` |
| REZICS vocabulary | `https://rezics.com/ns/` |
| Published schema contracts | `https://rezics.com/schema/` |
| Source contracts | `https://rezics.com/schema/sources/` |
| UUID namespace seed (format 2) | `https://rezics.com/ns/schema/identity/v1` |

These are identifier contracts, not a claim that HTTP routes or DNS deployments
were published. External standard IRIs keep their original domains. Only the
explicit Schema.org HTTP/HTTPS alias policy affects identity normalization;
original RDF spelling stays intact. The former `rezics.org` namespace and format 1
have no compatibility bridge. Development/test state is rebuilt.

## Installation and generated owners

```sh
task libraries:schema-importer:convert -- all
task libraries:schema:catalogue
task services-main:db:generate -- schema_complete
# On the intended development database, using its configured DATABASE_ADMIN_URL:
task services-main:db:migrate
REZICS_SCHEMA_DATABASE_URL='postgresql://…' task libraries:schema-importer:import
```

The **main deployment owns the only production migration history**, including
canonical functions/triggers in `services/main/src/services/database/schema/postgres`.
The old standalone 18-table migration owner is removed. Released SQL and the
installation epoch remain intact; replacing the active model does not rewrite a
released installation history. The preview Drizzle config writes only to `.temp`.

```ts
import { mediaItem, wikiPage, schemaTerm } from "@rezics/schema/postgres";
import { terms } from "@rezics/schema/terms";
import { defineRelationTables } from "@rezics/schema/postgres/vocabulary";
const mediaRelations = defineRelationTables("media");
const creator = terms.schemaorg.creator;
```

A deployment choosing another relation family installs its generated Drizzle DDL
and `relationIntegritySql(family)` guards. Physical family names never enter
portable logical references. Arbitrary source SQL is never executed.

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

### Workloads and split boundaries

The local 500M/3B checkpoints are not a global corpus ceiling. In a 1T-image
planning scenario, 3 page occurrences and 2 retained observations per image imply
3T occurrence rows and 2T observation rows before representations, metadata or
indexes. These are arithmetic scenarios, not measured throughput or an ingestion
plan. Video streams/fragments can multiply rows independently of file count.

| Workload | Authoritative locality and growth |
| --- | --- |
| Images/video/audio | `media_item` plus observations, representations and fragments by media identity; occurrence records grow with page appearances. A URL, a blob and an appearance are different grains. |
| Forum | Native post identity and thread/root locality, replies, reactions and edits; one hot thread needs an explicit writer/ordering budget. |
| Chat | Conversation-local ordered messages; only actual edits append closed bodies. Group message insertion does not synchronously fan out counters to every member. |
| Wiki | Fewer page identities, but per-language revisions, payloads and outbound links can dominate size. History/link scans use page/revision keys. |
| Vocabulary/schema | Small replicated release/term/profile metadata. A dictionary UUID does not require a synchronous central allocator. |

A physical split moves an owner's identity, revisions and authoritative selections
as a unit. Keep its local FKs; replace cross-owner storage FKs with explicit logical
reference validation and deletion/erasure delivery when moving across databases.
This requires a migration adapter and a placement/version fence; merely dropping
constraints is not a valid split. The bounded relation-family transfer test proves
stable IDs, history, exact lexical values, selected revisions and rejection rules
survive table/database relocation. It does not claim that every domain has an
online shard mover or that an arbitrary custom database already satisfies the
same transaction/constraint contract.

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

## Verification

Current acceptance and reproducible commands are recorded in
[the importer README](../schema-importer/README.md#verification) and the
[active execution plan](../../docs/plan/README.md#active-execution).
Prior 18-table standalone results do not qualify this replacement.
