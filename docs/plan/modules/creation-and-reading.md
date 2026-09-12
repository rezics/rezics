# M05: Book, original creation and reading

Dependencies: M02-M04. Owners: [Book/creation tests](../../testing/book-and-creation.md), [creation model](../../architecture/database/creation.md).

## Remaining work

- Use Book as the first full backend journey: create, draft, revise, publish, organize chapters, read, resume, discuss, collect, export and withdraw.
- Begin with a metadata-only REZICS Work, then admit and adopt independent official/community multilingual content, including same-language alternatives. Separate all-language contribution policy, particular language support and actual readable coverage; pin exact reading selections.
- Qualify [BOOK21-BOOK28](../../testing/book-and-creation.md), including external editions, anthology/part coexistence, repeated occurrences, independent revisions and shared Unit features.
- Cover original writing and AO3-derived scenarios through native Work, Entity, Association, Document, Publication, structure, tags and participation.
- Represent source works/crossovers, fandom/grouping, character appearance, contextual pairings, translation/adaptation/inspiration and series without AO3-specific native tables.
- Test co-creation, pseudonyms, anonymous presentation, ownership separation, gifts and creative collections/events. Privacy/withdrawal choices need explicit retention semantics.
- Preserve rating, warning, nondisclosure and unknown states with search, spoilers and exact progress.
- Replace whole-journal aggregation/deletion work with incremental statistics and bounded deletion; qualify child/manifest disclosure and revocation races independently of the parent authority boundary.
- Build stateful author/reader APIs and export after native commands; frontend stays behind G4.

## Acceptance

Use produced IDs and multiple principals. Original works need no fabricated source/fandom. A fanwork relationship is not a global canonical character fact. Progress pins its structure/content version. Private drafts and annotations stay private in history, search and exports.
