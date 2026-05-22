## Why

Units need searchable common names beyond their official `UnitTranslation` display text: abbreviations, old titles, user slang, transliterations, and alternate spellings are discovery metadata, not new Unit identities. Rezics already has a stronger identity model than canonical tag systems: `Unit` is the canonical identity, while aliases should widen search recall through votes and owner/admin pinning.

This change defines alias search as a score-and-pin driven discovery layer, not a manual canonical/wrangling system.

## What Changes

- Add a `UnitAlias` model for searchable alternative names attached to a Unit.
- Add a `UnitAliasVote` model so users can vote on whether an alias is useful for finding that Unit.
- Define `value` as the display/audit text and `normalizedValue` as the machine matching and de-duplication key.
- Add owner/admin pinning for aliases. Pinned aliases remain searchable even below the visibility threshold but do not receive ranking boost.
- Define alias search inclusion semantics: include aliases in search if `score > threshold OR pinned = true`.
- Apply the same search inclusion principle to tag search/indexing: owner-pinned `UnitTag` rows remain searchable even below the score threshold, but pinned does not boost ranking.
- Keep `UnitTranslation` as the authoritative language-specific display text. Aliases do not replace translations and do not create canonical merge relationships.
- Do not introduce AO3-style canonical tag wrangling, synonym collapse, or realm-local tag identity.

## Capabilities

### New Capabilities

- `unit-alias-search`: Defines Unit aliases, alias votes, normalization, owner/admin pinning, visibility threshold behavior, and search indexing semantics.

### Modified Capabilities

- `unit-translation`: Clarify that translations remain primary display text and aliases are supplemental search metadata.
- `content-index`: Add alias-derived searchable fields and define `score > threshold OR pinned` inclusion for aliases and tag-derived search fields.
- `content-search-contract`: Ensure content search treats alias matches as normal search text matches without special pinned ranking boost.
- `tag-scoring`: Clarify that pinned `UnitTag` rows remain searchable below the visibility threshold but pinned does not alter `score`, `voteCount`, or ranking weight.
- `entity-search-index`: Add alias-derived searchable names for entity Units.
- `realm-search-index`: Add alias-derived searchable names for realm Units.

## Impact

- Affected packages:
  - `package/server`: Prisma schema, alias service/API, vote handling, authorization, Meili sync triggers.
  - `package/contract`: alias DTOs, mutation schemas, search document/schema updates.
  - `package/api`: alias client functions, mutations, query keys, search type exposure.
  - `package/search`: content/entity/realm document build and patch logic for alias fields.
  - `package/app`: future alias management UI and search result behavior, if included in implementation.
- APIs:
  - Adds alias and alias-vote endpoints. Existing translation endpoints remain unchanged.
  - Existing search endpoints keep their route shape; indexed text expands to include accepted aliases.
- Database:
  - Adds `UnitAlias` and `UnitAliasVote`.
  - Adds indexes for `(unitId, normalizedValue)`, search lookup by `normalizedValue`, and score/pinned visibility queries.
- Compatibility:
  - Additive for translations and search callers.
  - Search result ordering may change naturally because additional searchable text can match existing Units.
  - No canonical alias merge system, no legacy alias shim, and no duplicate Unit identity layer are introduced.
