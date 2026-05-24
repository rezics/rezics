## 1. Prisma Models

- [x] 1.1 Add `UnitAlias` to `package/server/prisma/schema.prisma` with `unitId`, `value`, `normalizedValue`, optional `language`, `kind`, `status`, `score`, `voteCount`, `pinned`, optional `position`, creator metadata, and timestamps.
- [x] 1.2 Add `UnitAliasVote` with composite uniqueness for one vote per `(aliasId, userId)`.
- [x] 1.3 Add indexes for `(unitId, normalizedValue)`, `normalizedValue`, `(unitId, pinned, position)`, and score/visibility queries.
- [x] 1.4 Generate and review the Prisma migration.
- [x] 1.5 Run `bun --filter=@rezics/server run prisma:generate`.

## 2. Contract Types

- [x] 2.1 Add alias DTO, alias vote DTO, create/update/pin/vote schemas, path params, and list query schemas to `package/contract`.
- [x] 2.2 Define alias `kind` and `status` literal unions in contract.
- [x] 2.3 Update Meili/content/entity/realm search document schemas with alias-derived searchable fields.
- [x] 2.4 Document `value` as display/audit text and `normalizedValue` as machine matching text.

## 3. Alias Service And API

- [x] 3.1 Implement a conservative alias normalizer in `package/server` using trim, Unicode NFKC, case folding where applicable, whitespace collapse, and low-risk separator normalization.
- [x] 3.2 Implement alias creation/upsert behavior that de-duplicates by `(unitId, normalizedValue)` according to the endpoint contract.
- [x] 3.3 Implement alias vote upsert and score/voteCount recalculation.
- [x] 3.4 Implement owner/admin pin, unpin, reposition, hide, and delete operations.
- [x] 3.5 Mount alias and alias-vote APIs from `package/server/src/index.ts`.
- [x] 3.6 Add mapper tests and service tests for normalization, duplicate handling, voting, pinning, authorization, and deletion/hiding.

## 4. Search Indexing

- [x] 4.1 Add alias-derived searchable fields to content document build and patch logic in `package/search`.
- [x] 4.2 Add alias-derived searchable fields to entity and realm search document build/patch logic.
- [x] 4.3 Update search index settings so alias fields are searchable with deliberate priority below primary translation title fields.
- [x] 4.4 Add alias write/update/delete triggers to patch affected search documents.
- [x] 4.5 Ensure alias indexing uses `score > visibilityThreshold OR pinned = true`.
- [x] 4.6 Add tests that pinned low-score aliases are indexed, unpinned low-score aliases are excluded, and pinned does not alter stored score.

## 5. Tag Search Inclusion

- [x] 5.1 Update content tag indexing so `UnitTag` rows are included when `score > visibilityThreshold OR pinned = true`.
- [x] 5.2 Ensure unpinned UnitTags at or below the threshold are excluded from `tagIds`, `tagLabels`, and related searchable fields.
- [x] 5.3 Ensure pinned UnitTags preserve raw `tagScores[tagUnitId]` and do not receive ranking boost.
- [x] 5.4 Add tests for pinned low-score UnitTag search inclusion and no pinned score boost.

## 6. API Client And UI Surface

- [x] 6.1 Add `package/api` alias API client functions, mutations, query keys, and exported types.
- [x] 6.2 Add minimal app/admin management surfaces only if required by the implementation scope; otherwise keep UI work out of this change.
- [x] 6.3 Ensure search result display continues to resolve titles from UnitTranslation even when the match came from an alias.

## 7. Validation

- [x] 7.1 Run targeted alias service/API tests.
- [x] 7.2 Run targeted search sync tests for content, entity, realm, alias inclusion, and tag inclusion.
- [x] 7.3 Run affected TypeScript checks for `@rezics/contract`, `@rezics/server`, `@rezics/search`, `@rezics/api`, and any touched app package.
- [x] 7.4 Run `bun run check:convention`.
- [x] 7.5 Run `openspec validate introduce-unit-alias-search --strict`.
