# Provider-independent catalog model

This is the native catalog contract. [The database design](README.md) owns shared identity, revision, provenance and access mechanisms; [the dictionary](data-dictionary.md) names the table families. Source schemas are conformance evidence, not the definition of REZICS objects. No old schema/API/data compatibility constrains this target.

## Provider-independent model

Identify referents by the objects and operations the product supports. A new provider describing an existing object adds observations, mappings and evidence, not another native copy. An owner is a physical/domain boundary; semantic class, structural capability, contextual role, lifecycle, presentation and authorization are separate dimensions.

| Distinction | Native rule |
| --- | --- |
| Work and hosted text | Creative referent and maintained Document are independent identities connected by exact uses/derivations. |
| Expression/translation and publication | Text/version identity differs from an issued specification and its language/territory/date events. |
| Recording and track | A recording is reusable; a track is an occurrence with local number/title/credit in a medium. |
| Version and distribution | Software functional variants/builds differ from releases, registry coordinates, files and installations. |
| Structure and membership | Containment/ordered occurrences differ from series/franchise/world membership and governance selection. |
| Grouping and subsite | Catalog Grouping, Realm community grouping and Collection curation retain distinct identities; Zone composes page/subsite infrastructure over one or more Collections. |
| Individual and account | Person/character/organization/software-agent referents do not imply login or control. |
| Asset and representation | Media identity, rendition, location, native use and default display are separate. |

Known concrete objects can exist without fabricated unknown Work, Edition or Release parents. Multiple capabilities may describe one referent, but independently governed identities are not merged merely because one UI shows them together.

[Realm, Collection and Zone composition](../realm-collection-zone.md) defines wiki corpora, contextual "published in" relationships and the separately modeled, optional Dynamic Collection direction. A wiki ecosystem may contain many Collections; neither a topic name nor a Zone requires one universal grouping owner.

## Edition and composition

There is no mandatory universal Edition layer. A translation is an expression; hardcover/paperback is a publication specification; a deluxe game with a soundtrack/book is a distribution composition; a professional software edition may be a functional variant. A provider's staff-grouping key is a source-qualified contribution context until evidence establishes another referent.

Mixed distribution packages have optional identities, sealed manifests and repeated typed members. Quantity, coverage, local credit, printed number and order belong to each occurrence. Grouping membership grants no ownership, access, ratings or progress. A Work page may select representative release artwork while preserving the actual release use.

## Fixed structure and dynamic semantics

Use typed tables/FKs for domain invariants and frequently queried fields: track-to-recording, release contents, episode occurrences, dependencies and technical TOCs. Use versioned definitions and typed assertions for extensible classifications, properties and contextual relations. An n-ary relation has its own identity/revision and role-bearing participants. Do not use untyped JSON or an arbitrary triple table to bypass structural guarantees.

Each field has one writer. Source-managed fixed fields record the decision and update the effective native column atomically. Structural revisions own their own values and evidence. Shared semantic export projects these authorities; it does not create a competing editable truth.

## Current selected domain scope

- Publishing: Work, text expression, catalog publication, release event, serialization, installment, translation and Book creation/reading.
- Music: Work, recording, release group/release, media/tracks, artist credits, release labels/events, TOC/identifiers, candidates/alternative presentations and artwork uses.
- Program: work, season, cut/version, episode, occurrence and distribution/broadcast context.
- Software: project/content, functional variant/build, release, platforms/language/media, patch/dependency targets and contribution contexts.
- Entity/reference: people, organizations, characters, software agents, areas/places/events/instruments, concepts and web resources required by elected sources.
- Grouping: universe/world, canon/continuity, franchise, series, membership and order.
- Distribution/media: cross-domain packages; assets/representations/locations/uses and scoped selection.

AO3-derived creative behavior and Skill/Prompt/MCP catalog behavior use these owners; their additional contracts are [creation](creation.md) and [Hub](ai-hub.md). General commerce, hardware, course delivery and hosted compute activate only when their real product operations are elected; indexing an object is not implementing its business service.

## Language, names and authority

Preserve BCP 47 identity using pinned registry/mapping policy. Source vocabulary conversion precedes standards validation; a provider-specific spelling must not redefine a public language tag. Distinguish missing language, undetermined, multiple languages and no linguistic content; do not infer script or territory from a broad tag.

Multiple names in one language are legal. Original/translated/transliterated role, human/machine/mixed method, source claimant, authorizing entity and officialness are independent. Officialness pins the exact name/version and applicable territory/channel/time; preferred display is a separate selection. Syntax-valid identifiers remain claims, with visible collisions unless a namespace's authority justifies uniqueness.

UI locale, metadata localization, original/translation language and consumption channels differ. Search preserves the matched name and relevant context. Inference/romanization may aid display but cannot replace source spelling or claim official translation.

## Conformance and growth

Every selected distinction requires source-free commands plus appropriate cross-provider fixtures, exact evidence, query and export. [Source conformance](../../testing/source-conformance.md) owns provider coverage. Unknown/partial/unobserved/withdrawn/private values survive roundtrips. No source account/vote becomes native authority or participation.

Use owner/aggregate-local keys, bounded manifests and keyset pages. Estimate every growing relation at 500M/3B rows and account for member/history/evidence amplification. [Capacity](capacity.md) contains recalculable scenarios; they do not prove runtime capacity.
