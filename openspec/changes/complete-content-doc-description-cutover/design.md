## Context

The `introduce-content-doc-schema` change made `Post.content`, `User.description`, and `UnitTranslation.description` canonical `ContentDoc` JSON fields. The database migration wraps existing plain string descriptions into `ContentDoc.main.source`, and the public DTO contracts now expose descriptions as `ContentDoc` or `null`.

Fresh factory seed data can still violate that contract because several post-migration write paths persist raw strings into JSON columns:

- `package/server/prisma/factory/users.ts` writes `User.description` as a generated paragraph string.
- `package/server/prisma/factory/generators.ts` models translation descriptions as `string`, and multiple factories forward that value directly into `UnitTranslation.description`.
- Infrastructure seed paths such as the default realm seed still write string descriptions.
- Some create contracts and services for unit-backed domains still accept or forward string translation descriptions even though DTOs expose `ContentDoc`.

PostgreSQL accepts JSON strings in `Json?` columns, so Prisma and the database do not reject the bad shape. The mismatch is detected later at Elysia response validation, for example when `PostDTO.author.description` is validated through `publicUserSchema`.

## Goals / Non-Goals

**Goals:**

- Make every canonical rich-description write path persist `ContentDoc` or `null`, never a JSON string.
- Align seed/factory generation with the public contracts so a fresh seeded database validates.
- Provide a repair path for development databases that already contain JSON string descriptions.
- Add focused tests that catch future regressions at the contract boundary and seed/write helpers.

**Non-Goals:**

- Do not introduce a backward-compatible plain string description API.
- Do not change `User.bio` or `UnitTranslation.summary`; both remain plain text.
- Do not add PostgreSQL `descriptionText` columns or canonical text projections.
- Do not implement structured slot editing or richer ContentDoc rendering beyond the existing schema.

## Decisions

### Decision: Normalize at write boundaries, not response mappers

Canonical server write paths will store the correct shape. Response mappers such as `mapPublicUser`, `mapUserToDTO`, and unit translation mappers should continue to expose stored values directly after focused type narrowing/casting.

Alternatives considered:

- Normalize in every mapper: this would hide corrupted data and let invalid canonical rows continue to accumulate.
- Relax DTO schemas to allow strings: this would undo the ContentDoc cutover and contradict existing specs.

### Decision: Use `markdownContentDoc()` for generated plain text

Seed/factory text sources remain simple strings internally, but conversion happens before writing to `User.description` or `UnitTranslation.description`. For generated descriptions, `markdownContentDoc(source)` is the canonical wrapper.

This keeps text corpus utilities simple while making the database boundary explicit.

### Decision: Cut over remaining internal contracts where practical

Contracts that model canonical rich-description writes should accept `contentDocWriteSchema` / nullable variants instead of `t.String()`. UI-specific forms may still hold markdown text locally, but they must call `markdownContentDoc()` before invoking canonical APIs.

Where an endpoint intentionally accepts a legacy string for ergonomic reasons, the service must wrap it before persistence and tests must document that adapter behavior.

### Decision: Add a one-time repair script or migration for JSON string rows

Development databases seeded after the ContentDoc migration may already contain JSON string values. The implementation should include an idempotent repair that wraps rows where `jsonb_typeof(description) = 'string'` into:

```json
{
  "schema": "rezics.content",
  "version": 1,
  "main": { "type": "markdown", "source": "<old string>" }
}
```

The repair should convert empty or whitespace-only strings to JSON null, matching the original migration semantics.

## Risks / Trade-offs

- [Risk] Some call sites intentionally pass user-entered markdown strings today. → Mitigation: keep local UI state as strings, but require API payload construction to wrap with `markdownContentDoc()`.
- [Risk] Search indexes may have stale `descriptionText` after repair. → Mitigation: include targeted sync or reindex instructions for affected user/content/entity/realm documents after data repair.
- [Risk] Mapper-level fallback would make tests pass while canonical storage remains dirty. → Mitigation: tests should inspect persisted values or validate DTOs produced from actual service/factory rows.
- [Risk] Broad contract changes may touch multiple packages. → Mitigation: keep changes scoped to rich-description inputs and avoid unrelated DTO or UI refactors.

## Migration Plan

1. Update seed/factory generation so future data is valid.
2. Align remaining canonical write contracts and services.
3. Add an idempotent repair path for existing JSON string descriptions in `User` and `UnitTranslation`.
4. Run the repair in development environments that have already run the latest factory seed.
5. Resync or reindex affected search documents where `descriptionText` may have been derived from the old bad shape.
6. Verify with focused tests and `bun run check:convention`; run broader package tests if implementation touches shared contract/server code.

Rollback is not expected because this is a development-stage clear cutover. If rollback is needed locally, restore from database backup and rerun the previous seed, but API response validation may remain broken until the cutover is reapplied.

## Open Questions

- Should the data repair live as a Prisma migration, a one-shot script, or both? A migration gives automatic repair on database update; a script is easier to re-run after local reseeding.
- Should intentionally ergonomic string-input endpoints remain for realm/shelf/entity creation, or should all canonical contracts switch to `ContentDoc` immediately?
