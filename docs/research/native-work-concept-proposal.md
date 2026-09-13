# Native Work concept proposal

This is an unadopted conceptual proposal for the catalog, creation, knowledge and source-mapping owners. It evaluates a common REZICS Work definition across creative domains. It does not amend the selected architecture or qualify implementation. Evidence was checked through 13 September 2026; publication dates and model approval status are distinguished below.

**Recommendation.** Define Work at the product level as a persistent, explicitly bounded creative whole maintained in REZICS. Apply this definition across literary, musical, audiovisual, interactive, software and other intellectual creations. Organize Works through multiple classification facets and explicit relationships. Use established models to preserve meaningful distinctions and support interchange, while making REZICS's own identity and continuity rules explicit.

The proposal combines faceted knowledge organization, selected distinctions from LRMoo, contextual assertions and provenance, and domain-specific evidence. This combination is an analytical recommendation for REZICS's requirements. None of the reviewed studies establishes it as a universally optimal ontology or demonstrates its performance for this product.

**The question being resolved**

The current [catalog contract](../architecture/database/catalog-model.md#rezics-work-and-primary-version) defines a virtual REZICS publication primarily through Book and `publishing_work`, then preserves a different meaning for domain objects such as musical works. That leaves the broader product question unresolved: what common meaning makes something a native Work in REZICS, regardless of its engineering owner?

The desired model must support native authoring and metadata-only cataloging; official and community contributions; multiple alternatives in the same language; independently maintained parts and compilations; stable historical references; and external sources with incompatible object boundaries. These requirements apply to subtitles and localizations as well as translations, and to albums and software distributions as well as anthologies.

Three questions need separate answers: what object has identity, how that object is classified, and which content is currently used to present or experience it. A classification label cannot supply all three answers. Native identity also differs from a description record: creating a REZICS entry about an existing film does not create that film, and revising its synopsis does not revise its cut.

**Research findings and their limits**

Gnoli's April 2025 paper argues that shared concepts can retain a stable definition while participating in different disciplinary contexts. It examines phenomenon-based classification and the tension between common reference and multiple perspectives. This supports considering an object before its position in a domain-specific hierarchy. It does not provide a tested identity rule for translations, remakes or forks.[^1]

Maculan, Soares and Marques's August 2026 study interprets contemporary knowledge-organization problems through faceted classification principles, including decomposition, synthesis, explicit relations and extensibility. Its published abstract describes an integrative review and conceptual framework. The evidence used here is that abstract; it supports a design direction, not measured gains in a REZICS-like system.[^2]

Recent work does not uniformly endorse faceting. Monterroza-Rios's June 2026 proposal develops an eight-rank hierarchy for artefacts using constitution, structure, mechanisms and functions. Its illustrative application concerns physical artefacts. The proposal's use of exclusivity and dominant characteristics would require additional justification for overlapping creative forms. It is useful as a competing conceptual approach; REZICS should not adopt its hierarchy solely because it is recent.[^3]

Machado and Arakaki's April 2026 study constructs a theoretical crosswalk between IFLA LRM and Schema.org. It identifies incomplete compatibility arising from their different purposes and leaves empirical validation to future work. This supports explicit mappings with stated limitations rather than interpreting identically named classes as identical objects.[^4]

Version currency matters. IFLA endorsed LRMoo 1.0 in April 2024. The CIDOC site also publishes LRMoo 1.1.1, dated October and announced November 2025, approved by the CIDOC CRM SIG. The two approval statements should not be conflated.[^5] Its F1/F2 declarations cover poems, music, films, visual art and evolving works, already demonstrating that a common Work concept can extend beyond books.[^6]

**Comparison of established approaches**

The suitability assessments below are recommendations, distinct from the cited descriptions of each system.

| Approach | Relevant contribution | Recommended place in REZICS |
| --- | --- | --- |
| Facet analysis and UDC | UDC supports synthesizing subjects, attributes and general characteristics across knowledge domains.[^7] | Use the method to design independent facets. Evaluate vocabulary mappings separately; a classification schedule does not decide native Work identity. |
| SKOS | Stable concepts, multilingual labels, broader/narrower/related links and mappings between schemes.[^8] | Use its distinctions for classification vocabularies. A classification concept and a particular Work remain different referents. |
| LRM/LRMoo | Distinguishes creative content, its expressions, manifestations, parts, derivations and creation activities.[^6] | Use as the strongest conceptual reference for content distinctions. REZICS additionally needs native authoring, content adoption and governance rules. |
| BIBFRAME | Separates Work, Instance and Item; its overview permits translation relationships between Works.[^9] | Use as a library interchange model with explicit mappings. Its Work boundary cannot be assumed identical to LRMoo's or REZICS's. |
| Schema.org CreativeWork | Broad coverage including books, movies, photographs and software; its example/realization/derivation vocabulary is deliberately broad.[^10] | Use for public descriptive interoperability. Refine relationships internally where that breadth would obscure identity. |
| Wikidata | Item statements can carry multiple values, qualifiers, references, ranks and explicit unknown/no-value states.[^11] | Borrow contextual assertion and evidence practices. Define content adoption, permissions and identity review independently. |
| MusicBrainz and VNDB | MusicBrainz separates works, recordings and release groups; VNDB distinguishes visual novels, releases, language information and patch status.[^12][^13][^14] | Use as domain evidence and conformance cases. Preserve each source's terminology without allowing its grain to dictate native Work identity. |
| OAI-ORE and W3C PROV | ORE separates aggregations, their descriptions and resources in context; PROV separates entities, activities, agents and derivations.[^15][^16] | Borrow composition and provenance distinctions. Neither defines the complete creative identity or adoption policy REZICS needs. |
| CodeMeta and SWHID | CodeMeta supports software metadata interoperability; SWHID identifies precise software artefacts using content and relevant metadata.[^17][^18] | Preserve project, source, release and exact artefact distinctions. Exact artefact identity does not decide whether two projects are one Work. |

A material disagreement illustrates the mapping problem. LRMoo describes translations as different expressions of a Work. MusicBrainz's Work overview lists translation among distinct works, while BIBFRAME also allows a Work to be a translation of another Work.[^6][^12][^9] REZICS therefore needs its own declared scope for grouping contributions, plus preservation of the distinctions required by each source.

**Proposed common definition**

> A REZICS Work is a persistent native creative whole with an explicitly identified origin or authoring intention, a declared scope, and continuity rules. It is maintained as an object that people can describe, contribute to, organize, discuss and encounter through one or more content realizations or selections. Its identity can persist while descriptions, available contents and selected presentations change.

“Creative” includes intellectual, artistic, editorial and functional creations. “Whole” means that the object is deliberately identified as a unit with a meaningful scope. It does not require a single medium, a single author, a completed body, a formal release, or an external counterpart. A work of software or an authored knowledge resource can satisfy the definition alongside a novel or song.

In product terms, this is REZICS's maintained virtual form of a work. An adopted reading, listening, viewing or software-content selection can give it a particular published state. The persistent Work and that exact state are separately referable. “Primary” can describe the native entry point within its declared scope; it should not imply a globally preferred external edition or a unique root for an entire creative family.

Origin, purpose and scope are necessary descriptive anchors, not a mechanical uniqueness formula. Two unrelated calculator programs can share a purpose. Two novels can share a theme. Identity also depends on their actual creative history and an accountable determination of continuity.

All of the following can qualify under the same definition: a novel, a song/composition, an independently identified recording, an authored album, a film, a game, a software project, an illustration, or a maintained reference article. Whether they qualify depends on their identity and scope, not the spelling of their current table or upstream class. Domain distinctions remain useful specializations and relationships within the common model.

People, organizations, events and subjects remain distinct categories of objects. A person's biography can be a Work; the person is not thereby a Work. A private list of favorites remains a collection unless a separately identified editorial creation is intentionally established. Such establishment does not absorb the identities of its members.

This definition does not require every content revision or file to become another Work. A contribution needs independent credit and history even when it has no separate Work-level identity. If it is also recognized and maintained as an independent creative whole, its existing content can be linked to that Work without copying the content.

**Identity and continuity rules**

Use an explicit scope statement for each Work: what creative whole is identified; its origin or initiating project; which variants and components are within scope; and which important related objects are outside it. A scope statement can begin incomplete, with unknown correspondence preserved. Classification and metadata can be corrected without reidentifying the object.

The following are proposed defaults, not universal results established by the literature:

| Change or relationship | Default identity treatment | Reason or qualification |
| --- | --- | --- |
| Rename, corrected author spelling, genre reclassification | Same Work | The description changes; the identified creation does not. |
| Add a faithful translation, subtitles or localization | Preserve the parent Work; identify the contribution and its exact versions | Language change alone does not force a new native Work. A substantial adaptation can warrant a related Work. |
| Select a different contribution for a language or audience | Same Work, new selection | Selection history changes independently of both the Work and the contribution. |
| Add a publisher edition, encoding or distribution platform | Preserve the relevant Work; identify the issued version or representation as needed | Distribution does not by itself establish a new creative whole. |
| New performance or independently maintained recording of a song | Preserve the composition; separately identify the performance/recording | A recording may itself qualify as a Work under a recording scope. Its relation to the composition remains explicit. |
| Adapt a novel into a film; create a substantially independent remake | Related Work | The new creation has its own origin, scope and creative continuity. Shared story or brand is insufficient for identity. |
| Ordinary software development or a maintenance branch | Normally the same project Work | A new branch or version label alone does not establish independent creative identity. |
| Establish an independently directed software fork | Related Work when its independent continuity is declared | Repository duplication alone is insufficient; copied code can initially be identical. |
| Create an anthology, concept album or editorial compilation | Independent composite Work when its editorial whole is identified | Member Works remain independently addressable and reusable. |
| Move editors, change community stewardship or default language | Same Work by default | Control and presentation are contingent features. Editorial disagreement alone does not prove a new creation. |
| Radically replace the identified subject or creative scope | New related Work or explicit identity-correction process | Stable identity must not conceal substitution of an unrelated object. |
| Ambiguous remaster, director's cut, game remake or port | Record evidence and leave the boundary unresolved until reviewed | A marketing label or similarity score cannot settle all such cases. |

The decision procedure first asks whether the described creation changed or only its record did. It then identifies the changed content, production or editorial act; tests continuity against the declared Work scope; and records the resulting relation and evidence. A disputed boundary remains disputed. Automatic matching may propose candidates, but cannot silently turn uncertain correspondence into identity equality.

OntoClean supplies a useful review discipline: investigate identity and dependence, and avoid confusing an object's contingent roles with the kind of thing it is.[^19] Applied here, being featured, community-maintained, selected or officially distributed should not by itself define Work identity. These REZICS-specific consequences are design judgments.

**Classification model**

Use several defined facets that may have their own hierarchies. Permit meaningful overlap across facets and compatible types. Definitions should record inclusion criteria, exclusions, examples and context; broad labels need not automatically become strict logical subclasses.

| Question | Example values or relations | Where meaning attaches |
| --- | --- | --- |
| What creative form is it? | Novel, composition, recording, album, film, game, software, reference article | Work, with compatible multiple classifications where justified |
| How is it expressed or experienced? | Text, still image, sound, moving image, interactive computation | Particular content; Work-level declarations must distinguish potential from available forms |
| What is it about or what genre does it use? | Space exploration, romance, mystery, educational purpose | Contextual classifications or subject relationships |
| How is it organized? | Single piece, multipart work, episodic work, editorial compilation, evolving resource | Declared structure and explicit component relationships |
| How was it related to earlier creations? | Translation, adaptation, arrangement, remix, fork, sequel | Typed relationships to the actual source and, where relevant, its exact revision |
| Which language and accessibility variants exist? | Text language, subtitles, dubbing, audio description, interface language | Contribution, channel, coverage and compatible selected content |
| What is its present state? | Planned, unfinished, continuing, complete, withdrawn | Owner-maintained lifecycle, separate from classification |

A visual novel may be classified as a game and an interactive narrative and use text, images, audio and executable content. This does not require creating one identity for each medium. Conversely, a novel and its animated adaptation remain different creative objects even when they share many classifications.

Each community may select vocabulary labels or organize discovery differently while referring to the same Work. Changes in preferred vocabulary or classification must not automatically fork the Work. Cross-scheme mappings need to distinguish stronger and weaker correspondence; a broad association between classifications is not evidence that two particular Works are identical.

**Content, contribution and publication semantics**

For every domain, distinguish a content relationship from an adoption decision. A community subtitle file can translate dialogue in a particular cut; adopting that file into a REZICS viewing selection is an additional decision. Neither the translation claim nor the adoption makes the subtitle publisher-official. The same reasoning applies to literary translation, song lyrics, software localization and accessible alternatives.

Content may be original, translated, arranged, edited, synthesized or otherwise derived. Preserve contributor, inputs, method, claimed authority, coverage and exact revision where meaningful. Selected contributions can coexist as alternatives. Private drafts and an editor's latest version are not implicitly the public selection.

Composition also needs explicit meaning. Distinguish creative whole/part, membership in a collection, use in a particular selection, packaging in a release, and derivation. ORE's contextual resource descriptions offer a useful precedent for keeping a resource's placement separate from its global identity.[^15] REZICS additionally requires repeated occurrences in one structure with independent order, coverage and stable citations; this requirement needs its own contract rather than being assumed from ORE.

A native Work may remain metadata-only indefinitely. That state means no hosted work content is being presented under the relevant policy, not that the external creation never existed. Creating a new native authoring project can likewise precede its first completed content. Preserve the difference between a known existing creation, an explicitly initiated project and an unsubstantiated external correspondence.

Available content is richer than a set of languages. “Chinese is supported” does not guarantee that a Chinese subtitle fits every cut or that a patch applies to every game build. The model should record compatibility and coverage for the selected content. The all-language contribution policy remains separate from availability; it requires no preallocated language matrix.

**Cross-domain examples**

| Case | Native Work and contribution behavior | Distinctions that must survive |
| --- | --- | --- |
| Novel A with two Chinese translations and a Japanese translation | One Work can organize the original and alternative contributions; the reading selection names exact versions | Independent translation credits, histories, officialness, external ISBN editions and partial coverage |
| Song S with score, translated lyrics and several recordings | The composition has its own scope; recordings have their own identities and may qualify as recording Works | A translation of lyrics is not automatically a new composition; a selected recording is not identical to the composition |
| Album C including recordings R1 and R2 | An identified editorial or artistic album can be a composite Work; tracks select exact recordings | Repeated tracks, alternate sequence, release packaging and independent recording identity |
| Film F with two cuts, subtitles and community audio description | The Film Work organizes compatible viewing alternatives, with reviewed cut boundaries | Cut-specific timing, independent contributions, release editions and separately identified remakes |
| Game G with PC/console releases and community localization | The native game identity can organize versions and compatible contributions across platforms | Patch applicability, content changes, officialness, remake relations and separately maintained mods |
| Software P with releases, maintained language packs and fork Q | P retains project continuity; Q can have independent Work identity with explicit derivation | Exact source/build references, compatibility, independent development and shared initial code |
| Maintained illustrated reference resource R | R can evolve across text, diagrams, audio and translations | Metadata corrections, content revisions, multiple viewpoints and exact published selections |

These are proposed product interpretations, not declarations that upstream systems model the examples identically. In particular, preserving MusicBrainz's distinctions does not require making REZICS's general Work category synonymous with MusicBrainz Work. A MusicBrainz recording or release group may correspond to a differently scoped native Work, an issued variant, or evidence for several native objects.

**Source mapping and editorial authority**

Mappings should identify the source scheme and version, source object, native target and its declared scope, relation, coverage, evidence and uncertainty. Supported outcomes include correspondence to a creative scope, realization, external release, component, contextual use, source-only observation and unresolved mapping. A source object can inform several native targets; several sources can inform one target.

No provider ID, title, ISBN, language or content hash is a sufficient universal identity rule. A metadata record, a creative referent and its digital representation have different identity conditions. A direct equality assertion is reserved for cases whose referents and granularity actually agree. An export can project bibliographic components without claiming the native Work itself is exactly an LRM entity.

Separate authority over the native Work, authority over a contribution, and evidence about external authorship or officialness. Editorial adoption changes what REZICS presents. It does not rewrite the creation's provenance or transfer a contributor's rights. PROV supplies a vocabulary for provenance; the applicable REZICS access and adoption decisions remain separately enforced.[^16]

**Options and recommended choice**

| Option | Benefit | Why select or reject it |
| --- | --- | --- |
| Adopt LRMoo Work directly as the only native Work definition | Strong conceptual reference and library interoperability | Useful as a mapping target, but does not itself specify REZICS's maintained native object and contribution governance. Requires additional product decisions anyway. |
| Adopt Schema.org CreativeWork with unrestricted properties | Broad media coverage and simple public vocabulary | Too permissive to settle continuity, exact references, selection and identity disputes without additional rules. |
| Preserve unrelated domain Work meanings and share only capabilities | Minimizes conceptual changes to the current owner model | Leaves the requested common product meaning unresolved and makes source/owner boundaries disproportionately influential. |
| Adopt a common native Work definition with facets and explicit domain relations | Covers native maintenance, media diversity, multiple contributions and precise distinctions | Recommended. Its main cost is explicit scope and continuity governance, plus carefully qualified external mappings. |

The recommendation keeps one meaning for native Work while allowing many creative forms and scope levels. It does not promise that every relation is interchangeable or that a parent and its components are the same Work. A common conceptual category does not prescribe a single physical table, database, service, or inheritance tree.

**Proposed acceptance before architecture adoption**

Use semantic examples with expected answers before choosing a schema. The following constitute a review matrix; they are not executed tests:

1. Create metadata-only native Works for a novel, composition, film, game and software project under the same definition, without fabricated releases or content.
2. Reclassify a Work or add a compatible creative form without creating a replacement identity.
3. Show that two unrelated creations with the same title, genre, purpose or initial bytes are not automatically one Work.
4. Adopt same-language alternatives for a literary translation, film subtitle and game localization while preserving independent credits and histories.
5. Change a selected contribution and still resolve an earlier exact reference and its historical context.
6. Distinguish supported languages from compatible, currently usable content; reject a subtitle/cut or patch/build mismatch.
7. Explain composition, recording, album, track occurrence and release under the common Work definition without collapsing their identities.
8. Represent a compilation and its constituent Works independently, including repeated use and partial coverage.
9. Preserve a Work through ordinary metadata, stewardship and presentation changes; create an explicit related Work for a separately established creative fork.
10. Keep contradictory remake/edition/translation claims unresolved until reviewed; preserve the evidence after a decision.
11. Map differing LRMoo, BIBFRAME, MusicBrainz and VNDB grains without automatic source-driven merges or erasure of native contributions.
12. Distinguish a classified Work from its subject, its metadata description, its default presentation and the community that maintains it.

Only after these examples agree should persistence and API owners select the physical design and executable tests. Existing Unit references and permission contracts are supporting mechanisms, not evidence that these semantic cases already pass. Corpus-scale qualification retains the existing 500,000,000-row baseline and 3,000,000,000-row estimate; this proposal makes no storage or throughput claim and requires no new distributed infrastructure.

**Changes to propose in the current documentation**

The first follow-up would establish one product-level native Work contract, with cross-domain examples and explicit scope/continuity rules. The catalog model would specialize that definition for publishing, music, audiovisual and software cases. Source-specific meanings would remain documented at mapping boundaries. The engineering dictionary would follow the agreed concepts rather than define them.

Creation and language documentation would apply contribution/adoption/availability semantics to all applicable creative forms. Integration specifications would include music, audiovisual and interactive cases alongside Book. Book can remain the first end-to-end implementation journey, provided that the common definition has already survived those other cases.

Three choices deserve explicit review during adoption: how easily an independently maintained contribution receives Work-level identity; how native scope disputes are resolved while preserving alternative interpretations; and the default boundary rules for cuts, remakes, arrangements and software forks. Recommended defaults are independent identity when a creative whole is deliberately established, one native identity across mere viewpoint changes, and evidence-based domain rules with unresolved outcomes permitted. No pending choice prevents reviewing the common definition now.

**Sources**

[^1]: Claudio Gnoli. [Is an all-purpose classification possible? Insights from Farradane's approach to knowledge organization](https://link.springer.com/article/10.1007/s11229-025-05011-9). *Synthese* 205, 177, 15 April 2025. Open-access conceptual research; relevant sections on interdisciplinarity and unique definition.

[^2]: Benildes Coura Moreira dos Santos Maculan, Filipi Miranda Soares and Francis Bento Marques. [Faceted Classification Theory as a Conceptual Foundation for the Evolution of Knowledge Organization Systems in AI-Mediated Environments](https://periodicos.ufmg.br/index.php/advances-kr/article/view/66915). *Advances in Knowledge Representation* 6(2), 1–22, 26 August 2026. Published abstract consulted; full PDF was not accessible during this review.

[^3]: Alvaro David Monterroza-Rios. [Toward a General Taxonomy of Artefacts: A Linnaean-Inspired Systematic Proposal](https://link.springer.com/article/10.1007/s13347-026-01069-6). *Philosophy & Technology* 39, 118, 20 June 2026. Open-access conceptual proposal; taxonomy, methodological principles and illustrative physical-artefact application.

[^4]: Dayane Onaga Ferreira Machado and Ana Carolina Simionato Arakaki. [IFLA Library Reference Model and Schema.org for Semantic Enrichment of Library Catalogs](https://doi.org/10.31083/KO47266). *Knowledge Organization* 53(2), 47266, 24 April 2026. [Publisher full text](https://storage.imrpress.com/IMR/2047568738855870500/application/2942-3309-53-2-47266.pdf). Exploratory theoretical crosswalk, including its methodology and compatibility limits.

[^5]: IFLA. [Now available: Object-oriented LRM conceptual model](https://www.ifla.org/news/newly-available-object-oriented-lrm-conceptual-model/), 13 December 2024, reporting April 2024 approval of 1.0. CIDOC CRM. [LRMoo version 1.1.1](https://cidoc-crm.org/lrmoo/ModelVersion/version-1.1.1), dated October 2025 and announced November 2025, stating CIDOC CRM SIG approval.

[^6]: IFLA LRMoo Working Group and CIDOC CRM SIG. [Classes and Properties Declarations of LRMoo 1.1.1](https://cidoc-crm.org/extensions/lrmoo/html/LRMoo_v1.1.1.html), November 2025. F1 Work, F2 Expression, F3 Manifestation and their relationships. Used as a conceptual reference, not a claim of native REZICS conformance.

[^7]: UDC Consortium. [UDC Scope](https://udcc.org/index.php/site/page?view=about_scope). Current official explanatory page, accessed 13 September 2026.

[^8]: W3C. [SKOS Simple Knowledge Organization System Reference](https://www.w3.org/TR/skos-reference/), Recommendation, 18 August 2009; [SKOS Primer](https://www.w3.org/TR/skos-primer/), Working Group Note, 18 August 2009. Concepts, labels, semantic relations, schemes and mappings.

[^9]: Library of Congress. [Overview of the BIBFRAME 2.0 Model](https://www.loc.gov/bibframe/docs/bibframe2-model.html), 21 April 2016. Current official overview, accessed 13 September 2026. Its age is distinct from continuing implementation: the [BIBFRAME-to-MARC conversion specifications](https://www.loc.gov/bibframe/bftm/index.html) include updates dated 17 April 2026 and describe Hub, Work, Instance and Item conversion.

[^10]: Schema.org. [CreativeWork](https://schema.org/CreativeWork). Current vocabulary page, accessed 13 September 2026. Definition and exampleOfWork, workExample, translationOfWork and encoding properties.

[^11]: Wikidata. [Help:Statements](https://www.wikidata.org/wiki/Help:Statements), page last edited 5 June 2025 as shown when accessed 13 September 2026. Statements, multiple values, qualifiers, references, ranks and unknown/no-value distinctions.

[^12]: MusicBrainz. [Work](https://musicbrainz.org/doc/Work), accessed 13 September 2026. Distinctiveness and aggregate works. The page identifies itself as not reviewed by the documentation team; the translation example is reported as its documented convention, not a universal musicological rule.

[^13]: MusicBrainz. [Release Group](https://musicbrainz.org/doc/Release_Group) and [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), accessed 13 September 2026. Separately identified core resources and domain structure.

[^14]: VNDB. [Kana API](https://api.vndb.org/kana#release-fields), accessed 13 September 2026. VN/release distinctions, release languages, patch and official status, linked VNs and partial/complete coverage.

[^15]: Open Archives Initiative. [ORE Specification: Abstract Data Model](https://www.openarchives.org/ore/1.0/datamodel), version 1.0, 17 October 2008. Aggregation, Resource Map, Proxy and aggregation-specific sequencing. This is a contextual-resource precedent, not a claim that the specification supplies REZICS's repeated-occurrence contract.

[^16]: W3C. [PROV-DM: The PROV Data Model](https://www.w3.org/TR/prov-dm/), Recommendation, 30 April 2013. Entities, activities, agents, derivation and alternate/specialized descriptions.

[^17]: CodeMeta Project. [Project overview](https://codemeta.github.io/), accessed 13 September 2026. Software metadata, research/discovery/citation and cross-platform interoperability. No claim about the latest vocabulary release is required for this proposal.

[^18]: SWHID. [Specification v1.2, core identifiers](https://www.swhid.org/specification/v1.2/5.Core_identifiers/). Content, directory, revision, release and snapshot identification; accessed 13 September 2026.

[^19]: Nicola Guarino and Christopher Welty. [Evaluating ontological decisions with OntoClean](https://doi.org/10.1145/503124.503150). *Communications of the ACM* 45(2), 61–65, 1 February 2002. [Author-uploaded text](https://www.researchgate.net/publication/297428382_Evaluating_ontological_decisions_with_ontoclean). Identity, rigidity and taxonomic consistency.
