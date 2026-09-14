# Provider-independent catalog model

This is the native catalog contract. [The database design](README.md) owns shared identity, revision, provenance and access mechanisms; [the dictionary](data-dictionary.md) names the table families. Source schemas are conformance evidence, not the definition of REZICS objects. No old schema/API/data compatibility constrains this target.

## Provider-independent model

Identify referents by the objects and operations the product supports. A new provider describing an existing object adds observations, mappings and evidence, not another native copy. An owner is a stable logical responsibility domain with its own physical representation; semantic class, structural capability, contextual role, lifecycle, presentation and authorization are separate dimensions.

| Distinction | Native rule |
| --- | --- |
| REZICS Work and contributed content | The platform's maintained virtual publication has its own identity; Documents and text versions are independently maintained content adopted into it. |
| Work and release | Independent identities using shared domain composition contracts; release-specific identifiers and scope do not define the native Work. |
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

[Native Work and release](native-work.md) is the common product contract for all creative domains. Its definition is not derived from `publishing_work` or any other engineering owner. Literature, musical compositions, independently maintained recordings/albums, films, games, software, visual and mixed-media creations use the same identity/continuity rules, with domain-specific structures and applicable properties.

A primary native Work can be metadata-only or organize official/community multilingual content. Work and release identities remain distinct while reusing composition, revision and capability protocols. Virtual and actual releases share the same release contract with applicable identifiers, scope and provenance. Domain adapters determine which concrete structures implement the contract; no mandatory universal Work or Edition parent is introduced.

## External editions and composition

Publisher identifiers, languages, territories and dates belong to the release/content scope they actually describe. They do not constrain the native Work's community contributions. Source records may have unknown Work or text correspondence and remain valid without fabricated parents. Provider names such as Work, Edition and Release require reviewed mappings rather than one-to-one native promotion.

A translation has independent content and revision identity; hardcover/paperback is a catalog publication specification; a deluxe game with soundtrack/book is a distribution composition; a professional software edition may be a functional variant. Preserve those distinctions within the common model. An external staff-grouping key is a contribution context until evidence establishes another referent.

All selected contents follow the [composition protocol](content-composition.md). Each Work/release owns its explicit occurrences and exact published selection. Repeated target uses have different occurrence identities, order and coverage; a parent/target pair is not their unique key. Importing a child structure creates local occurrences without copying its independently owned content. Family/series/derivation relations support discovery and do not dynamically supply a publication's missing contents or transfer grants, ratings or progress.

## Bibliographic evidence and mapping limits

The [evidence matrix](design-evidence.md#native-work-and-classification) records current conceptual models, primary papers and their limits. Native Work is not automatically LRMoo Work, BIBFRAME Work or a source-provider Work. Bibliographic export maps content, realization, publication, aggregation and uncertainty explicitly; a native multi-work content container may require several mapped components. The absence of sufficient metadata to identify a text remains unknown, not a fabricated intermediate identity.

## Fixed structure and dynamic semantics

Use typed tables/FKs for domain invariants and frequently queried fields: track-to-recording, release contents, episode occurrences, dependencies and technical TOCs. Semantic classifications use governed Tag/Expression/Application identities; catalog class adapters consume that same authority. Versioned definitions and typed assertions describe properties and contextual relations without introducing a parallel editable classification system. An n-ary relation has its own identity/revision and role-bearing participants. Do not use untyped JSON or an arbitrary triple table to bypass structural guarantees.

Dynamic here means extending logical definitions and values. It does not require a physical SQL table for each class, property, Work or user. Registering a logical owner or changing its physical mapping is an explicit schema/adapter change; generic features use the [Unit capability contract](README.md#34-unit-capabilities-across-owner-tables). Queryable properties additionally need the [selected index contract](README.md#13-search-recommendation-export-and-derived-state); storing a typed value does not qualify arbitrary filtering or sorting.

Each field has one writer. Source-managed fixed fields record the decision and update the effective native column atomically. Structural revisions own their own values and evidence. Shared semantic export projects these authorities; it does not create a competing editable truth.

[Event-time discovery](event-time.md) applies this rule to concrete events, domain release/broadcast occurrences and named-event topic bindings. An Event category does not own a single occurrence date; concrete event facts retain actual/planned role, precision, calendar and provenance through elected date queries. AI company/model/version targets use [shared rating contexts](ratings.md), with independent target and evaluation identities rather than per-class score storage.

## Current selected domain scope

- Publishing: native textual Works, text/translation identities, virtual/actual catalog publications, release events, serialization, installments and Book creation/reading.
- Music: native Work scopes over compositions, independently maintained recordings and albums where established; distinct recording, release-group/release, media/track, credit, event, TOC and artwork structures.
- Program: native audiovisual Work scopes, seasons, cuts/versions, episodes, occurrences and distribution/broadcast context.
- Software: native project/game Work scopes, functional variants/builds, releases, platforms/language/media, exact patch/dependency targets and contribution contexts.
- Entity/reference: people, organizations, characters, software agents, areas/places/events/instruments, concepts and web resources required by elected sources.
- Grouping: universe/world, canon/continuity, franchise, series, membership and order.
- Distribution/media: cross-domain packages; assets/representations/locations/uses and scoped selection.

AI company/model rating journeys are selected native catalog/discovery scope.
A company uses its organization referent; an independently maintained model
creation and its known versions use applicable Work/software or supporting
reference contracts with explicit structural admission. Unknown correspondence
does not fabricate a build or version. A classification Tag does not dictate a
new owner. Indexing/rating these identities does not elect model execution,
weight hosting, metering or the other service operations in dictionary D16.

AO3-derived creative behavior and Skill/Prompt/MCP catalog behavior use these owners; their additional contracts are [creation](creation.md) and [Hub](ai-hub.md). General commerce, hardware, course delivery and hosted compute activate only when their real product operations are elected; indexing an object is not implementing its business service.

## Language, names and authority

Preserve BCP 47 identity using pinned registry/mapping policy. Source vocabulary conversion precedes standards validation; a provider-specific spelling must not redefine a public language tag. Distinguish missing language, undetermined, multiple languages and no linguistic content; do not infer script or territory from a broad tag.

Multiple names in one language are legal. Original/translated/transliterated role, human/machine/mixed method, source claimant, authorizing entity and officialness are independent. Officialness pins the exact name/version and applicable territory/channel/time; preferred display is a separate selection. Syntax-valid identifiers remain claims, with visible collisions unless a namespace's authority justifies uniqueness.

UI locale, metadata localization, original/translation language and consumption channels differ. Search preserves the matched name and relevant context. Inference/romanization may aid display but cannot replace source spelling or claim official translation.

## Conformance and growth

Every selected distinction requires source-free commands plus appropriate cross-provider fixtures, exact evidence, query and export. [Source conformance](../../testing/source-conformance.md) owns provider coverage. Unknown/partial/unobserved/withdrawn/private values survive roundtrips. No source account/vote becomes native authority or participation.

Use owner/aggregate-local keys, bounded manifests and keyset pages. Estimate every growing relation at 500M/3B rows and account for member/history/evidence amplification. [Capacity](capacity.md) contains recalculable scenarios; they do not prove runtime capacity.
