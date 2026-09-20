# Native Work and release contract

This is the product-level definition for every creative domain. The [catalog model](catalog-model.md) assigns domain responsibilities; the [dictionary](data-dictionary.md) records relational keys. Neither a provider's vocabulary nor an existing table defines Work. Implementation and qualification follow the [plan](../../plan/README.md).

## Native identity

A REZICS Work is a native creative object that the platform identifies, maintains and publishes within an explicit content scope and continuity policy. Treat its native form as REZICS's virtual publication, even when only metadata is present. It can organize contributions of different media, languages and sources without corresponding to an actual publisher-issued edition. Work is a common semantic abstraction; its physical representations may remain in separate domain tables.

The definition applies to literary, musical, recorded, audiovisual, visual, interactive, software, editorial and other intellectual creations. It does not require every Work to have the same properties. A musical composition, an independently maintained recording and an album may each qualify under different scopes; their identities and relationships remain distinct. Existing `publishing_work`, `music_work`, `program_work` and software structures must be evaluated against this definition rather than exempted from it by their names. Do not introduce a mandatory additional universal Work parent merely to implement the abstraction.

Identify what creative object is being maintained, its known origin or initiating activity, and the content/variants within its scope. Unknown authorship or correspondence is allowed. These anchors are not a mechanical uniqueness formula: matching names, purposes, identifiers, classifications or bytes is insufficient to merge Works. Creating a record about an existing film does not create that film; editing its synopsis does not revise its cut. An explicitly initiated native creation can precede its first completed content.

People, organizations, places, events and subject concepts remain separately identified objects. Their descriptions can be Works; their existence does not make them Works. A personal favorite list or ordinary Collection does not automatically establish an editorial Work. A contribution has independent attribution/history even when it has no independently maintained Work identity.

## Identity and continuity decisions

| Change | Selected default |
| --- | --- |
| Correct names, metadata or classification | Preserve Work identity; revise the owning description/assertion. |
| Add translations, subtitles, dubbing, language packs or accessibility contributions | Preserve the relevant Work; independently identify contributions, exact versions and applicability. Language alone does not allocate another Work. |
| Select a different contribution, editor or default presentation | Preserve Work identity; revise adoption, authority or presentation separately. |
| Add a publisher edition, carrier, file encoding or platform release | Identify the release/representation as appropriate; do not reidentify the Work solely for distribution. |
| Establish a new recording, adaptation, remake or independently directed software fork as a creative object | Give that independently maintained scope its own Work identity and an evidenced relation to the source. A repository copy or marketing label alone is insufficient. |
| Establish an anthology, album or independently maintained part | Each may have its own Work; preserve member identities and explicit aggregation/part/use relationships. No family-wide primary uniqueness rule applies. |
| Substantially change the identified creative scope or discover mistaken identity | Use an explicit new related identity or correction case; do not silently substitute an unrelated referent. |
| Cannot determine whether a cut, remaster, port or contribution is a separate Work | Retain the evidence and unresolved/disputed correspondence until the continuity decision is justified. |

The decision records scope, changed content or creative activity, evidence, relation and responsible authority. These are REZICS rules, not universal conclusions supplied by a classification system. Mere differences of community viewpoint do not automatically fork identity. A series or compilation and its independently maintained parts can all be primary native entry points within their own scopes.

## Work and release structure

A Work and each release have distinct identities. A release identifies a particular distribution specification or selected publication scope; it may be platform-curated/virtual or describe an external actual issue. Both use the same domain-appropriate composition, revision, naming, provenance and capability protocols, with explicit applicability differences. Virtual and actual releases do not require two parallel feature systems.

| Concern | Work | Release |
| --- | --- | --- |
| Native identity and lifecycle | Persistent creative scope and independently maintained state | Persistent issuing/selection scope and its own state |
| Content composition | Native adopted contents and alternatives | Exact selected contents, order and coverage for that release |
| Languages | May organize official and community contributions across languages | Describes the contributions actually included or declared for this release |
| Identifiers | Native identity and evidenced identifiers appropriate to the Work's referent | Additional publisher/distribution identifiers where applicable |
| Mutable metadata | Own revisions | Own revisions; correcting release metadata does not overwrite old content snapshots |
| Published content | Declared selection policy; ordinary Post-backed chapters follow context-eligible publication heads | Fixed releases bind exact adopted content/structure versions; no implicit nested membership expansion |

ISBN belongs to the corresponding publication specification, not to the primary native Work merely because both concern a book. Apply the same level-of-identification rule to musical, audiovisual and software identifiers instead of copying every source ID upward. Work is not a release with a few columns deleted: its content scope and update authority also differ.

External editions can be recorded with unknown Work/content correspondence rather than fabricated parents. A source record or relationship that says two objects correspond does not itself adopt either object's content. A social Publication owns an utterance or distribution announcement, separately from Work and release identity.

## Classification and applicable properties

Use independent, versioned facets with definitions, examples and exclusions. Creative form, content modality, subject, genre, style and purpose can overlap. Composition, derivation and contextual roles use explicit relationships; lifecycle and governance remain separate state. A vocabulary's broader/narrower edge is not automatically structural containment, strict subtype inheritance, identity equality or permission.

An interactive novel can be narrative, game, text, image and audio without creating an identity for each facet. Domain profiles specify permissible structure and attributes; shared Resource features do not require all domains to expose every profile. Dynamic definitions extend semantic data, while new structural behavior requires a validated domain contract.

| Attribute/structure | Applicable target and interpretation |
| --- | --- |
| Word/character count | Particular language/content revision, coverage and measurement algorithm; a Work-level display states which selection it summarizes. |
| Duration | An exact timed recording, cut or selected sequence; a composition with no timed realization need not have duration. |
| Image dimensions/resolution | The relevant image or rendition; pixels are not a universal Work attribute. |
| Chapters, tracks, episodes and ordered parts | Domain-validated occurrences in an explicit composition; repeated targets are allowed where meaningful. |
| Platforms, builds and dependencies | Exact software/game variants or releases, with compatibility rules. |
| Subtitle, dubbing and localization availability | Specific compatible cut, recording or build and coverage, not just a language name. |

Known zero, unknown value, not applicable and inaccessible are different outcomes. A pure audio Work has no text-body word count; an attached transcript can have its own count. Do not sum all language alternatives into one unqualified length or count both a container subtotal and its contained leaves. [Composition metrics](content-composition.md#measurements-and-read-models) own the aggregation rules.

## Contribution and language selection

The native Work may include community translations, lyrics, subtitles or software localization absent from every official release. Preserve each contribution's source, contributor, method, claimed officialness, applicability and exact revision. Several same-language alternatives may coexist. Adoption changes the selected use; it does not grant publisher officialness or transfer control of the contribution.

All-language contribution admission is a policy, not a preallocated matrix or proof that every language has readable content. Metadata localization, declared consumption languages, admitted contribution languages and actual usable content are separate. A subtitle must fit the selected cut and a language pack its build. Pure visual/nonlinguistic content is not assigned fictitious language support.

Metadata-only Work publication requires no dummy body or external release event. The [composition protocol](content-composition.md) distinguishes ordinary Post-backed chapter reading from fixed releases and reviewed selections. Ordinary reading follows context-eligible publication heads; fixed selections retain exact composition/content versions. Current disclosure remains independently enforced.

## Cross-domain interpretation

| Case | Required outcome |
| --- | --- |
| Novel with two Chinese translations and an external paperback | One native Work can organize both contributions; retain their identities, adoption choices and the paperback's issued specification. |
| Composition, independently maintained recording and editorial album | Apply the same Work definition to each qualifying scope; preserve realization, recording, track occurrence and release distinctions. |
| Film with two cuts and community subtitles | Keep compatible viewing selections and exact timings; separately identify a remake when its independent creative continuity is established. |
| Game/software with builds, language packs and an independent fork | Retain project continuity, exact compatibility and fork derivation; equal starting code is not identity equality. |
| Anthology and constituent or split Works | Each has its own identity and complete selected composition; membership does not inherit all future contents, ratings, grants or progress. |
| Mixed-media reference work | Multiple modalities and viewpoints share a native scope; component measurements and published selections remain explicit. |

## External models and evidence

Use external models for their distinctions and interchange contracts. LRMoo's Work groups intellectual content/expressions; the native REZICS object additionally has platform maintenance, adoption and publication semantics. BIBFRAME, Schema.org, MusicBrainz and other providers use different boundaries. Map referents, granularity, context, version and coverage explicitly; equal class names are not equal identities.

The [research basis](design-evidence.md#native-work-and-classification) records primary URLs, model versions, selected lessons and limitations. It supports faceted classification and careful version distinctions, not a claim that any external model or benchmark proves this complete design. [Native Work acceptance](../../testing/native-work.md) specifies the cross-domain qualification; [Book acceptance](../../testing/book-and-creation.md) remains one implementation journey.
