# Localization

Every user-visible frontend string belongs to the owner's typed locale resources:
`@rezics/i18n` for `apps/web`, and the locale content contract for `apps/about`.
This includes accessibility labels, placeholders, validation, notifications,
empty/loading states and metadata. Components consume messages rather than
embedding visible strings.

## Language and terminology

- Write natural prose in each locale. `zh-Hant` is region-neutral Traditional
  Chinese using Taiwan terminology and orthography.
- Use [verbatim terms](src/verbatim-terms.ts) for invariant brands, protocols,
  formats and technical identifiers. Do not create another allowlist or duplicate
  their spellings in TypeScript locale resources.
- Use the typed [termbase](src/terminology) for product/domain terms, selecting the
  semantic form appropriate to the sentence. Keep complete messages in their
  owner resources; do not duplicate approved forms or invent synonyms.
- When an approved product/domain term is missing, collect the affected concepts
  and ask the maintainer with context. Continue independent work; ordinary prose
  translation does not require terminology approval. Do not publish an invented
  term as approved or leave source-language wording in another locale.
- Generated terminology documents are read-only views, not sources of truth.

## Checks

Run the affected frontend workspace's TypeScript check for frontend changes.
For locale content changes, run `task libraries:i18n:policy:check`; for termbase
changes, regenerate with `task libraries:i18n:terminology:generate` and verify
with `task libraries:i18n:check`. Use the owning checks for other locale owners.
These establish code and localization integrity, not human rendered acceptance.
