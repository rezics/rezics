## Why

Chapter is currently modeled as `Unit(type=CHAPTER)` with its body borrowed into `UnitTranslation.description`, which is semantically wrong (description is a blurb, not body content) and offers no room for chapter-specific features like cover images or richer interaction surfaces. At the same time, cover images (`coverUrl`) are scattered across `Book`, `Game`, `Media`, and `Shelf` extension tables as language-neutral columns, even though covers are inherently language/edition-specific presentation data that logically belong alongside `title`, `subtitle`, `summary`, and `description` in `UnitTranslation`. Fixing both together is cleaner than fixing them separately, because they share the same architectural insight: presentation-layer, language-correlated data belongs in `UnitTranslation`.

## What Changes

- **BREAKING** Remove `CHAPTER` from the `UnitType` enum. Chapter becomes a kind of `Post` (`Post.kind = CHAPTER`, backed by `Unit(type=POST)`).
- **BREAKING** Add `CHAPTER` to the `PostKind` enum. Chapter body lives in `Post.body`. Chapter's parent book linkage lives in `Post.targetUnitId` (consistent with the existing "post about a unit" pattern) rather than abusing `Unit.workUnitId` (which is reserved for the work/release pattern).
- **BREAKING** Remove `coverUrl` column from `Book`, `Game`, `Media`, and `Shelf` models. Cover URLs relocate to `UnitTranslation.extra.coverUrl`, typed via a new contract-level schema `unitTranslationExtraSchema`.
- Add a new contract `unitTranslationExtraSchema` (Typebox) in `@rezics/contract` defining the shape of `UnitTranslation.extra`, starting with `{ coverUrl?: string }` and leaving room for future language-specific visual metadata (`coverAlt`, `blurhash`, `dominantColor`, etc.) without further migrations.
- Data migration: convert every existing `Unit(type=CHAPTER)` into `Unit(type=POST)` with a corresponding `Post` row (`kind=CHAPTER`, `body` seeded from the old `UnitTranslation.description`, `targetUnitId` seeded from the old `Unit.workUnitId`). Null out the migrated chapter's `Unit.workUnitId` so it no longer pollutes the work/release invariant.
- Data migration: for every non-null `coverUrl` on `Book` / `Game` / `Media` / `Shelf`, copy the value into `UnitTranslation.extra.coverUrl` for every translation row of that unit, then drop the column.
- Server: rewrite `chapter.service` / `chapter.api` as a thin wrapper over `post.service` filtered by `kind = CHAPTER` and `targetUnitId`. Update `book.service`, `media.service`, `game.service`, and `shelf.service` mappers to resolve `coverUrl` from `translation.extra.coverUrl` instead of the extension column.
- Frontend: update all components reading `coverUrl` from book/media/shelf/game DTOs (cards, covers, headers) to use the relocated path. Existing DTO surface stays flat (`coverUrl`) so consumer change is minimal.
- Seed: update seed mocks under `package/server/prisma/seed/mocks/` so they emit cover URLs via translation extras and emit chapters as `Post(kind=CHAPTER)` rows.

Non-goals:
- Not changing `Post.body` format (stays `String?`; markdown remains the storage format). A Json rich-doc migration is out of scope and is the concern of `editor-core`.
- Not adding `title` as a first-class column on `Post`. Chapter titles continue to live in `UnitTranslation.title`, consistent with every other `PostKind`.
- Not touching `Link.faviconUrl` (URL metadata, not cover) or `User.avatar` (identity, not language-specific presentation).
- Not introducing an IMAGE-unit-backed asset reference for covers. Covers remain plain URL strings; IMAGE unit type is reserved for Pixiv-style first-class image posts.
- Not unifying chapters across releases via `TranslationGroup` in this change. Chapters remain single-language artifacts of the release they were authored in; cross-release chapter alignment can be designed later.

## Capabilities

### New Capabilities

(None. All work modifies existing capabilities.)

### Modified Capabilities

- `unit-identity`: `UnitType` enum no longer includes `CHAPTER`.
- `unit-translation`: `UnitTranslation.extra` gains a contract-defined shape that carries presentation-layer, language-specific metadata; `coverUrl` is the first field codified.
- `type-extension-book`: `Book.coverUrl` column removed; book cover is resolved from `UnitTranslation.extra.coverUrl`.
- `type-extension-media`: `Media.coverUrl` column removed; media cover is resolved from `UnitTranslation.extra.coverUrl`.
- `type-extension-game`: `Game.coverUrl` column removed; game cover is resolved from `UnitTranslation.extra.coverUrl`.
- `type-extension-shelf`: `Shelf.coverUrl` column removed; shelf cover is resolved from `UnitTranslation.extra.coverUrl`.
- `type-extension-post`: `Post` gains `CHAPTER` as a legitimate kind; a chapter post's parent book is `Post.targetUnitId`.
- `post-kind-contract`: `PostKind` enum gains `CHAPTER`.

## Impact

Affected packages:
- `package/server` — Prisma schema, data migration, `chapter/`, `book/`, `media/`, `game/`, `shelf/`, `post/` services and mappers; seed mocks under `prisma/seed/mocks/`.
- `package/contract` — new `unitTranslationExtraSchema`; update `chapter.ts`, `book.ts`, `media.ts`, `game.ts`, `shelf.ts`, `post.ts` contracts.
- `package/api` — query/mutation layers for chapter, book, media, game, shelf that surface cover fields.
- `package/app` — components rendering book/media/shelf/game covers; chapter editor and reader flows that previously operated on `Unit(type=CHAPTER)` shape.
- `package/admin` — any admin surface that edits cover URLs or manages chapters.

Databases:
- Server DB only. One-shot data migration combined with schema migration. Auth DB untouched.

Backward compatibility:
- This change is **not** backward-compatible at the database level — `coverUrl` columns are dropped and chapter unit types are converted. The migration is designed to be atomic within a single Prisma migration step, so deployed clients must be updated together with the migration. There is no feature-flag rollout; we update the schema, data, and code together.
- Frontend DTO surface remains stable (`coverUrl` field still present on book/media/shelf/game DTOs) so UI callers don't break.

External systems:
- Search index (`@rezics/search` / Meilisearch): chapter documents previously indexed under `type=CHAPTER` will re-index under `type=POST, kind=CHAPTER`. Reindex is required as part of deploy.
- `@rezics/reaction`: unit IDs for chapters remain stable across the migration (same `Unit.id`, only `type` changes), so reaction associations are preserved.
