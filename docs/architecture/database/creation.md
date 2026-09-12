# Book and general creation contract

Book is the first end-to-end creation/reading acceptance journey. The model supports original and transformative creation through native owners, with no AO3-specific persistence namespace and no compatibility requirement with old Book/post structures.

## Objects and relationships

| Product concept | Native representation |
| --- | --- |
| Primary Book / REZICS Work | `publishing_work`, the maintained virtual publication defined by the catalog model; metadata-only authoring is valid. |
| Authored body | Document, language/representation variants, immutable revisions and explicit derivation. |
| Publishing and distribution | Work selects content through slots/structures; a social Publication has its own exact utterance manifest; external catalog publications retain publisher specifications. |
| Chapters/installments | Text identities and ordered, versioned structure occurrences with declared completion/coverage. |
| Anthology and constituent books | Independently maintained Works with explicit aggregation/part relationships and separate selected contents. |
| Series or user-curated collection | Governed Grouping/Collection identity and memberships/order; not automatically a Work or body containment. |
| Original work | Valid without a source Work or fabricated fandom. |
| Fandom/crossover/source work | Named grouping/source-work references and typed relationship assertions with evidence. |
| Character appearance | Entity participation in a particular Work/expression/continuity, with role and optional coverage. |
| Pairing or other relationship | Contextual association with typed participant roles; can be n-ary. |
| Translation/adaptation/inspiration | Explicit derivation/relation with exact input where known; no inferred endorsement or control. |
| Co-creator/pseudonym | Public credit/name plus independent private operator and editing authority. |
| Gift/dedication | Typed relationship and recipient presentation/acceptance state; no automatic ownership transfer. |

A story's relationship declaration applies in that story's context. It cannot silently establish a canon-wide fact about characters with the same identities. Source work, fandom, canon and Realm scope remain independently queryable. Ambiguous imported tags retain evidence/unresolved mappings instead of guessed native character identities.

## Work authoring and multilingual adoption

Use the [REZICS Work definition](catalog-model.md#rezics-work-and-primary-version) as the primary Book entry point. Create its metadata independently of any publisher edition, ISBN, source record or hosted Document. The metadata-only state can be published; it does not manufacture a publisher release event. A later content contribution keeps the Work identity and adds independently authorized content/adoption state.

A contributor maintains a Document/text identity and its revisions. A Work editor adopts an eligible exact revision into a canonical content slot with language and variant dimensions, and arranges occurrences in a versioned contents structure. Unadopted contributions, private drafts and the contributor's latest head are not implicitly published by appearing in a Work's context. Several same-language contributions can coexist; an explicit selection decides the current reading presentation without deleting alternatives or their credits. Adopting content does not transfer the contributor's editing rights.

The Work's language-admission policy may accept any language, including community translations absent from official publisher releases. Store that policy without preallocating a language-by-Work matrix. Language slots and contributions are sparse and created when needed. Particular declared consumption languages, metadata languages, actual readable coverage and the all-language policy are separate values. Officialness and method belong to the exact contribution/use; adoption by REZICS does not turn a community translation into a publisher-authorized one.

Publish an exact reading selection by sealing its structure manifest and pinning the relevant adoption/content revisions. Empty known contents, unknown contents and metadata-only publication are explicit states. Changes append the owning metadata, adoption or structure revisions; a metadata edit does not copy all chapters, and restoring metadata does not implicitly restore independently governed content. Reading progress and export pin the selected content and structure, rather than an unqualified current Work head.

An anthology Work can select contributions associated with constituent Works, and each split book can be independently maintained. Membership alone does not select all future child revisions. Repeated targets, partial coverage, alternate ordering and removal from one anthology preserve the independently maintained Work and its other uses. Work-level tags, discussion and favorites target the Work's logical Unit; content-specific annotations or translation feedback use their own precise targets through the same reference contracts.

## Publication and privacy

Draft, author release, scope adoption and current display remain separate. Co-creation requires explicit authority, preserves credits and supports revocation. Anonymous presentation hides specified public identity fields without pretending no accountable operator exists. Any relinquishment/orphaning feature needs a declared control/retention transition; it does not inherit another site's irreversible behavior implicitly.

Completion can be known complete, in progress, discontinued or unknown under the native vocabulary. Planned chapter count and observed/published count differ. Progress records exact content/structure interpretation; reordering or replacing chapters requires mapping or an explicit unknown result.

Ratings, archive-style warnings, choosing not to disclose warnings, unknown/not-rated state, contextual spoilers and display-safety labels are distinct. Search and filters must preserve those meanings rather than treating missing information as a safe value.

## Interactions and export

Comments/replies use Publication/Thread. Collections, bookmarks/favorites, subscriptions, reactions and private notes use their existing dedicated domains. Creative challenges/events may connect prompts, participants and submissions through explicit roles/lifecycle; a Prompt used for a writing challenge is not automatically an executable model template.

Exports preserve authored content, chapter order, credits, selected metadata and allowed references. Private drafts, hidden actors, suppressed history and private bookmarks stay protected. Media references retain exact use/version/disclosure.

The [Book/creation suite](../../testing/book-and-creation.md) maps AO3 behavior and original-creation requirements into these mechanisms. It is an acceptance specification, not a claim of full feature delivery.
