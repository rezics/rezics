## Why

POST-type units (wiki-style pages) need parallel translations where each language is a separate, independently-maintained Unit, not a child of a "work". The existing `UnitTranslation.sourceReleaseUnitId` mechanism is designed for the converging work/release model (BOOK/GAME/MEDIA) and is semantically wrong for POST. We need a distinct mechanism that groups parallel sibling posts as translations of one another, without introducing a canonical parent.

We also need a single, fast way to answer "what languages does this wiki topic offer?" at the scale of 10M+ Unit rows, without abusing `UnitSupportLanguage` (which describes per-unit content availability, not group-level language coverage).

## What Changes

- Add a new `TranslationGroup` table that groups parallel-translation sibling Units. It carries a denormalized `supportedLanguages` array so a single PK lookup returns all languages available in the wiki topic.
- Add `Unit.translationGroupId` (nullable FK to `TranslationGroup`). A Unit belongs to at most one translation group. Setting this field is immutable once assigned (`onDelete: SetNull`).
- Add `@@unique([translationGroupId, defaultLanguage])` on Unit: at most one unit per language per group.
- POST wiki flow: each post remains a monoglot Unit (`defaultLanguage` set, one `UnitSupportLanguage(self, defaultLanguage, isPrimary = true)` row). Sibling translations share a `translationGroupId`.
- Clarify in spec that `UnitTranslation.sourceReleaseUnitId` is strictly a work/release (BOOK/GAME/MEDIA) mechanism and SHALL NOT be used by POST.
- Add a doc comment on `Unit.isLanguageNeutral` in the Prisma schema.
- API additions under `/post` (or `/unit`) to: attach a new translation to a group (creating the group on first attach), detach, and list group siblings.
- Search/filter paths remain unchanged: each post still indexes its own language via `UnitSupportLanguage`. No cross-language dedup is introduced.

## Capabilities

### New Capabilities

- `post-parallel-translation`: Defines the `TranslationGroup` entity, how parallel POST translations join/leave a group, the `supportedLanguages` denormalization contract, and the "one unit per language per group" invariant.

### Modified Capabilities

- `unit-translation`: Add a requirement restricting `sourceReleaseUnitId` to work/release units only, and explicitly cross-reference the new `post-parallel-translation` capability for POST behavior.

## Impact

- **`package/server`**:
  - `prisma/schema.prisma`: new `TranslationGroup` model, new `Unit.translationGroupId` field + unique + index, doc comment on `isLanguageNeutral`.
  - `prisma/migrations/`: new migration creating `TranslationGroup`, altering `Unit`.
  - `src/unit/`: add service methods for translation-group attach/detach/list; mapper support.
  - `src/post/`: wiki add-translation flow wires into translation-group service.
  - `prisma/seed/mock`: seed a few wiki-style POST groups for development.
- **`package/contract`**:
  - New schemas for TranslationGroup DTOs and request/response shapes for attach/detach/list translations.
- **`package/api`**:
  - New TanStack Query hooks for reading group siblings and supported languages.
- **`package/app`**:
  - Post detail UI: when `translationGroupId` is set, render a language switcher built from `TranslationGroup.supportedLanguages`.
- **Search (`package/search`)**:
  - No index schema change required. Optionally expose `translationGroupId` on post search docs for future group-dedup; not in scope here.
- **Backward compatibility**:
  - Purely additive. Existing POST rows have `translationGroupId = NULL` and continue to behave as standalone posts.
  - `UnitTranslation.sourceReleaseUnitId` semantics are tightened via spec but not schema-breaking.
- **Performance**:
  - `TranslationGroup` is small (bounded by number of wiki topics, expected ≪ Unit row count) and its `supportedLanguages` lookup is an O(1) PK fetch.
  - `Unit.translationGroupId` index is small in practice (only wiki-participating units); consider a partial index `WHERE translationGroupId IS NOT NULL` in the migration to keep index size minimal.
