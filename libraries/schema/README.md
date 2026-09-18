# REZICS model and Drizzle schema

This package owns the native model and its PostgreSQL representation. Standard
vocabularies supply semantics; reviewed REZICS decisions supply grain, validation,
write authority and storage. Content providers supply records, not table designs.
The [architecture contract](../../docs/architecture/schema-modeling.md) explains
these boundaries and the alternatives deliberately rejected.

## Authoring and generated ownership

| Path | Owner and purpose |
| --- | --- |
| `model/domains.ts` | Authored concept/property decisions: standard meanings, identity grain, cardinality, ordering, allowed values, native writer and storage target. |
| `model/storage.ts`, `model/storage/` | Authored storage decisions for vocabulary/model metadata, identified relations, indexed media/selection, Wiki and semantic description histories. |
| `src/model/` | Portable model contract, exact datatype validation and executable record/authority validation. |
| `src/postgres/**/*.generated.ts` | Real Drizzle declarations emitted from the authored storage model. Do not edit. |
| Other `src/postgres/{domain}/*.ts` | Explicitly hand-authored native/operational Drizzle owners. Accounts, authorization, queues and payments cannot be inferred from an ontology. |
| `src/generated/model.ts`, `src/generated/terms.ts` | Compiled reviewed model and stable standard-term UUIDs. |
| [Model mapping report](docs/model.generated.md) | Every reviewed concept, predicate, writer, physical target and generated-table decision. |
| [Complete physical catalogue](docs/tables/README.md) | All current tables, columns, primary/foreign keys, indexes and checks, including manual operational owners. |
| [`../schema-importer`](../schema-importer/README.md) | Standard vocabulary parser, ontology/model compiler and Drizzle emitter. |
| [`../content-adapters`](../content-adapters/README.md) | Provider contract fixtures and content exchange readers; existing native provider writers remain in main's catalog owner. |

Generated files are not semantic inputs. The compiler checks target tables/columns
and native ownership, but does not derive the native model from the current database.
The native storage declarations were reviewed against their referents and lifecycle:
URLs do not identify bytes, appearances are independent occurrences, metadata editors
are distinct from media authors, and Wiki/message identities have no global parent.
Reusable primitive structure is generated; domain policy remains visible and authored.

## Standards and native meaning

RDF/RDFS/OWL, Schema.org, SKOS, PROV-O, Web Annotation, DCMI and BIBFRAME are pinned
machine vocabularies. SHACL 2017 is included as a constraint vocabulary; the selected
XSD 1.1 datatype implementations are listed explicitly in `src/model/datatypes.ts`.
The full ontology IR retains inheritance, strict domain/range, suggested domain/range,
inverses, equivalences, disjointness, retirement and referenced expression nodes.
Keeping an axiom does not implement an OWL reasoner or turn it into SQL validation.

The authored model distinguishes Book work, publication and text version; BIBFRAME
Item and Contribution descriptions retain their own referents. Schema.org Book alone
cannot choose work versus publication. A caller must select a profile. Known native
profiles use their named native writer; a generic description writer cannot accept a
native profile and create a competing representation.

An author credit uses an identified relation/participant with role and exact meaning.
The predicate/role UUID, relationship occurrence UUID and content-object UUID are
separate identities. Labels come from backend vocabulary/name storage and may have
arbitrarily many supported language tags. A translation change does not change an
existing definition ID. Audit attribution and routing/version keys remain columns.

Description revisions pin a compiled model/profile. Each statement pins its exact
predicate definition in that model's source releases. Source evidence, reviews and
AI assessments refer to edits or exact assertions. Acquiring external records can
require observations for replay, but does not define a second native source-book model.

`validateModelRecord` validates a bounded whole description revision and identifies
its authoritative writers. It is not authorization or endpoint existence proof.
Native writers retain their operational constraints. Unsupported datatypes are
explicitly reported in description mode and rejected for native adoption. The
original lexical value is never coerced through JavaScript numbers/dates.

## Drizzle generation and installation

```sh
task artifacts:prepare # fresh checkout; requires network for pinned inputs
task artifacts:generate # later offline rebuilds
task libraries:schema-importer:generate
task libraries:schema:catalogue
task libraries:schema-importer:inspect-model -- book-work
task libraries:schema-importer:validate -- annotation /absolute/record.json
task services-main:db:generate -- schema_model
```

`postgres` identifies the physical backend; filenames identify ownership.
`drizzle.config.ts` is configuration, while generated model files use a clear
`.generated.ts` suffix. Drizzle supports multiple schema files; a giant `drizzle.ts`
is not required ([official declarations](https://orm.drizzle.team/docs/sql-schema-declaration)).

The main service imports the complete package directly and owns the only production
migration history and canonical PostgreSQL functions/triggers. Released SQL and
the installation epoch are retained. This breaking change removes the prior
provider-contract tables and redundant descriptive-profile tables; development/test
state is rebuilt without compatibility transfer. The old 758-table inventory is
not evidence of semantic completeness. Current structure and coverage are generated.

## Identity, placement and corpus scale

Logical addresses contain a stable owner and UUID, never a table/database/shard.
Objects allocate IDs locally. A relation family can be instantiated in another
service without inserting a universal Unit/Thing/Work parent. The lazy reference
directory serves consumers that need concrete cross-owner references; it does not
allocate every content identity. Model/vocabulary metadata is small and replicated.

REZICS identifiers use `https://rezics.com/id/`, owned vocabulary uses
`https://rezics.com/ns/`, and published contracts use `https://rezics.com/schema/`.
External standard IRIs keep their original namespaces. These identifier contracts
do not assert that HTTP resolvers or DNS deployments have been published.

The 500M/3B repository checkpoints are local planning scales, not a global ceiling.
A hypothetical 1T assets with three page appearances and two observations implies
3T occurrence rows and 2T observation rows before representations, fragments and
history. Video streams multiply independently; forum/chat locality follows their
conversation/thread; Wiki has fewer identities but potentially large language,
revision and link histories. No such corpus is loaded to qualify this compiler.

A split moves the authoritative local identity/revision/selection unit. A new backend
must preserve exact values, stable IDs, idempotency, local atomicity, CAS, reference
validation and erasure delivery. Local FKs remain concrete; cross-store references
require a validating protocol. Merely dropping FKs or changing a connection string
is not a qualified migration. The model report records each owner's locality decision.

The [verification owner](../../docs/testing/schema.md) separates this pipeline's
executed evidence from earlier vocabulary-only checks and unrelated main IAM failures.
