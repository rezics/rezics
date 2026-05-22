## Context

`UnitTranslation` stores official language-specific display text for a Unit. That is not enough for discovery: users search by abbreviations, old titles, transliterations, simplified/traditional variants, unofficial common names, and misspellings. These are search metadata attached to a stable Unit identity.

Rezics does not need an AO3-style canonical/wrangling system because `Unit` already provides canonical identity. Alias records should widen recall and be governed by votes plus owner/admin pinning.

Target shape:

```txt
Unit
  UnitTranslation[]  // primary display text
  UnitAlias[]        // searchable common names

UnitAlias
  value              // original display/audit text
  normalizedValue    // machine matching and de-duplication key
  score/voteCount
  pinned/position

UnitAliasVote
  user vote on one alias row
```

## Goals / Non-Goals

**Goals:**

- Add Unit aliases as supplemental search metadata.
- Let users contribute aliases through a vote-backed model.
- Let owner/admin pinned aliases remain searchable even below the visibility threshold.
- Keep pinned as an inclusion rule, not a ranking boost.
- Define conservative normalization for alias de-duplication and matching.
- Apply the same search inclusion principle to owner-pinned UnitTags.

**Non-Goals:**

- Do not replace `UnitTranslation`.
- Do not create an AO3-style canonical tag or synonym wrangling system.
- Do not merge Units through aliases.
- Do not require each alias to point to only one globally unique Unit.
- Do not introduce complex language-specific normalization in the first pass.
- Do not change `RealmTagContext`.

## Decisions

### `value` is user-facing text; `normalizedValue` is machine-facing text

`value` preserves what was contributed and what moderators/users see:

```txt
"The Three-Body Problem"
"3 Body Problem"
"三体"
"三體"
```

`normalizedValue` is derived for matching and duplicate detection. The first-pass normalizer should be conservative:

- trim leading/trailing whitespace
- Unicode NFKC normalization
- case folding where applicable
- collapse whitespace
- normalize low-risk punctuation separators

The first pass should not automatically merge simplified/traditional Chinese, kana/kanji, romanization variants, or arbitrary punctuation-heavy strings unless a separate normalization decision is made later.

### Alias rows belong to Units, not translations

Aliases attach to `unitId` and may optionally carry `language`. They are search entry points for a Unit, not replacement display names for a translation. Display still resolves through `UnitTranslation`.

### Votes govern community aliases

`UnitAlias.score` is derived from `UnitAliasVote.value` and `voteCount` is derived from the count of votes. This mirrors tag scoring and makes alias usefulness a community signal.

### Pinning is an inclusion override, not ranking boost

Pinned aliases are indexed/searchable regardless of low score. Pinned does not change `score`, `voteCount`, Meilisearch ranking score, or score-based ordering. This matches the intended tag semantics: owner/admin intent is respected for inclusion but not treated as special ranking privilege.

### Search index stores alias text separately from translation text

Search documents should include alias-derived searchable fields such as `aliasValues` or domain-specific equivalents. Keeping aliases separate from `titles` makes ranking and debugging clearer and allows future search tuning without corrupting translation semantics.

### UnitTag searchable inclusion uses the same rule

For tag-derived search fields, `UnitTag` rows should be indexed when `score > threshold OR pinned = true`. Unpinned rows at or below the threshold are excluded from search. Pinned rows carry their raw score in `tagScores`.

## Risks / Trade-offs

- [Risk] Over-aggressive normalization merges distinct aliases. -> Mitigation: start with conservative normalization and add versioned/backfilled normalization later if needed.
- [Risk] Alias spam pollutes search. -> Mitigation: use score thresholds, vote counts, status/moderation fields, and owner/admin pinning.
- [Risk] Pinned aliases could be mistaken for ranking boosts. -> Mitigation: specify pinned as inclusion-only and test raw score preservation.
- [Risk] Search ranking changes because more text matches. -> Mitigation: keep alias fields explicit and tune searchable attribute priority separately.
- [Risk] Ambiguous aliases can point to multiple Units. -> Mitigation: allow search relevance and filters to resolve ambiguity rather than enforcing global canonical uniqueness.

## Migration Plan

1. Add `UnitAlias` and `UnitAliasVote` models and generate Prisma migration.
2. Add contract DTOs and input schemas.
3. Add server service/API for creating aliases, voting, pinning, listing, and deleting/hiding aliases.
4. Add content/entity/realm search document alias fields and patch helpers.
5. Update search index settings for alias fields.
6. Update UnitTag search indexing to use `score > threshold OR pinned`.
7. Add API client hooks/mutations.
8. Add focused tests for normalization, vote aggregation, pin inclusion, threshold exclusion, and no pinned ranking boost.

No data backfill is required for launch. Optional later backfill can seed aliases from known external metadata or imported old names.
