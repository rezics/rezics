# Provider-independent catalog model

This is the native catalog contract. [The database design](README.md) owns shared identity, revision, provenance and access mechanisms; [the dictionary](data-dictionary.md) names the table families. Source schemas are conformance evidence, not the definition of REZICS objects. No old schema/API/data compatibility constrains this target.

## Provider-independent model

Identify referents by the objects and operations the product supports. A new provider describing an existing object adds observations, mappings and evidence, not another native copy. An owner is a physical/domain boundary; semantic class, structural capability, contextual role, lifecycle, presentation and authorization are separate dimensions.

| Distinction | Native rule |
| --- | --- |
| REZICS Work and contributed content | The platform's maintained virtual publication has its own identity; Documents and text versions are independently maintained content adopted into it. |
| REZICS Work and external publication | The primary REZICS object is independent of any publisher's edition, ISBN, territory or official language list. |
| Text version and publication | A particular text/translation differs from both its REZICS adoption and a publisher's issued specification/events. |
| Recording and track | A recording is reusable; a track is an occurrence with local number/title/credit in a medium. |
| Version and distribution | Software functional variants/builds differ from releases, registry coordinates, files and installations. |
| Structure and membership | Containment/ordered occurrences differ from series/franchise/world membership and governance selection. |
| Grouping and subsite | Catalog Grouping, Realm community grouping and Collection curation retain distinct identities; Zone composes page/subsite infrastructure over one or more Collections. |
| Individual and account | Person/character/organization/software-agent referents do not imply login or control. |
| Asset and representation | Media identity, rendition, location, native use and default display are separate. |

Known external publications and other concrete objects can exist without fabricated REZICS Work, Edition or Release parents. Creating a REZICS Work is an explicit native authoring/adoption decision. Multiple capabilities may describe one object, but independently governed identities are not merged merely because one UI shows them together.

[Realm, Collection and Zone composition](../realm-collection-zone.md) defines wiki corpora, contextual "published in" relationships and the separately modeled, optional Dynamic Collection direction. A wiki ecosystem may contain many Collections; neither a topic name nor a Zone requires one universal grouping owner.

## REZICS Work and primary version

A REZICS Work is the platform's independently maintained virtual publication unit. For Book, its owning identity is `publishing_work`. "Primary version" names this native object, not an abstract equivalence class of creations or a preferred external edition. Treat it as what REZICS publishes, even when it contains only metadata. It need not correspond to any actual publisher-issued object and can evolve through community contributions. Its identity is independent of its current metadata, content selection and public/draft lifecycle.

A Work may adopt original content, official translations and community translations into one multilingual publication. Multiple contributions in the same language are legal; source, contributor, method, officialness, coverage and current adoption belong to the particular contribution or use. Adding a language does not require a matching publisher release or ISBN and does not create another Work automatically. An all-language contribution policy is a bounded policy declaration, not a requirement to preallocate every possible language or claim that each has readable content. Metadata languages, admitted contribution languages, declared consumption support and actual content availability remain separate.

The Work uses the shared content-slot, adoption and structure-manifest contracts to select exact content revisions; it does not own a copy of every Document. A metadata-only Work needs neither a dummy Document nor an external publication. Publishing its metadata does not assert that an original author or external publisher issued the REZICS object. A social Publication may announce or distribute a selection, but its utterance identity is separate from the Work. [Creation](creation.md) owns the authoring, adoption and reading journey.

Each independently maintained anthology and each constituent or split book can have its own Work. There is no rule choosing exactly one primary Work for an entire family, no exclusive parent determining all identity, and no ISBN-derived split/merge. Editorial aggregation, part/coverage relationships, ordered content occurrences, publisher packaging and user Collections have different meanings. A physical split alone does not force new Works; an explicit native decision may identify those parts independently. Work membership does not transfer content control, grants, votes or reading progress.

| Example | Native interpretation |
| --- | --- |
| Metadata-only book A | REZICS Work A, without a required text or external publication. |
| English original plus community Chinese and Japanese texts | Independently identified contributions/adoptions under A; no matching trilingual publisher edition required. |
| Two Chinese translations | Separate content identities and uses; language alone is not a unique content key. |
| Hardcover, paperback and ebook carrying publisher identifiers | External catalog publications linked by evidenced text/coverage relationships; none is the primary REZICS Work. |
| Anthology C and independently maintained books A and B | Three Works with explicit aggregation/part relationships and independent selected contents. |
| Metadata correction or replacing a selected translation | New metadata/adoption revision; stable Work identity and retained exact earlier references. |

This product definition does not redefine domain-specific referents merely named "work", such as a musical composition in `music_work`. A provider's conceptual work record is source evidence with a reviewed mapping, not automatic proof of a one-to-one REZICS Work identity. No mandatory abstract Work parent is introduced for Book.

## External editions and composition

There is no mandatory universal Edition layer. A translation has a text identity; hardcover/paperback is a catalog publication specification; a deluxe game with a soundtrack/book is a distribution composition; a professional software edition may be a functional variant. Book editions are issued versions, analogous to music releases. Publisher identifiers and release events stay on the referents they identify rather than becoming requirements on the REZICS Work. A provider's staff-grouping key is a source-qualified contribution context until evidence establishes another referent.

Mixed distribution packages have optional identities, sealed manifests and repeated typed members. Quantity, coverage, local credit, printed number and order belong to each occurrence. Grouping membership grants no ownership, access, ratings or progress. A Work page may select representative release artwork while preserving the actual release use.

Publication contents use parent/manifest/occurrence keys, not a unique parent/target pair: the same Work or text may appear twice, or with different coverage, in one manifest. Source correspondence and exact citations include that occurrence identity. Text-to-Work correspondence alone is not the Work's adopted contents; changes to either require their own authority and revision.

## Bibliographic evidence and mapping limits

[IFLA LRM (July 2024), sections 5.6-5.7](https://repository.ifla.org/bitstreams/7d23aa55-1f85-490f-b500-6170285585a6/download) distinguish expressions, manifestations and editorial aggregation. They support preserving those distinctions, but LRM's abstract Work is not the REZICS virtual-publication definition. Export must map actual content, editions and aggregation explicitly rather than relabeling every REZICS Work as an LRM Work. LRM's single Expression realizes one Work; a native multi-work text container therefore needs component mappings, not a claim of one-to-one conformance. An aggregating work's editorial selection also differs from a multipart work's whole/part relationship.

[O'Neill's Humphry Clinker study (2002)](https://www.oclc.org/content/dam/research/publications/library/2002/oneill_frbr22.pdf) found that reliable expression identification could require examining the books themselves. Preserve unknown text correspondence when only metadata is available; do not manufacture intermediate text identities or equate texts from similar records. These sources inform distinctions and uncertainty, not the product's definition of its primary object.

## Fixed structure and dynamic semantics

Use typed tables/FKs for domain invariants and frequently queried fields: track-to-recording, release contents, episode occurrences, dependencies and technical TOCs. Use versioned definitions and typed assertions for extensible classifications, properties and contextual relations. An n-ary relation has its own identity/revision and role-bearing participants. Do not use untyped JSON or an arbitrary triple table to bypass structural guarantees.

Dynamic here means extending logical definitions and values. It does not require a physical SQL table for each class, property, Work or user. A new physical owner is an explicit schema/adapter change; generic features use the [Unit capability contract](README.md#34-unit-capabilities-across-owner-tables). Queryable properties additionally need the [selected index contract](README.md#13-search-recommendation-export-and-derived-state); storing a typed value does not qualify arbitrary filtering or sorting.

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
