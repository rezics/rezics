## Context

### Current state

**Chapter.** Chapters are modeled as `Unit(type=CHAPTER)` with no extension table. Their body is stored in `UnitTranslation.description` — a field semantically intended as a short blurb, not a chapter's authored content. Their parent-book linkage uses `Unit.workUnitId`, which is the `work-release` capability's designated pointer for release-of-work grouping, and requires `release.type == work.type` — CHAPTER pointing at BOOK silently violates this invariant (see `openspec/specs/work-release/spec.md`). The `package/server/src/chapter/` domain exists with its own service/api/mapper, reads `Unit.type = CHAPTER` directly, and mirrors the chapter body in and out of `UnitTranslation.description`.

**Covers.** `coverUrl: String?` columns live on `Book`, `Game`, `Media`, and `Shelf`. Specs for book / media / game have described an aspirational `coverAssetUnitId` referencing an IMAGE unit, but neither the schema nor the seed data adopted that indirection. IMAGE `UnitType` is reserved for first-class image posts (Pixiv-style authored artwork). Using it for decorative cover thumbnails would be a category error; the user has explicitly ruled it out.

### Constraints

- Monorepo with shared contract package (`@rezics/contract`) — DTO shape changes ripple to server, api client, app, admin.
- Prisma migrations must be atomic with code rollout; no feature-flag gate.
- Seed data (`package/server/prisma/seed/mocks/`) must emit the new structure end-to-end; legacy shape is not supported.
- Search indexing (`@rezics/search` / Meilisearch) must be reseeded because type and kind fields shift.
- Reaction service (`@rezics/reaction`) is unit-keyed; unit IDs survive the migration so reaction associations are preserved.

### Stakeholders

- Backend: Prisma schema, `chapter/`, `book/`, `media/`, `game/`, `shelf/`, `post/` modules.
- Contract: new `unitTranslationExtraSchema`; DTO shape adjustments.
- Frontend: book/media/shelf/game card + cover components; chapter editor/reader; admin panels.
- Ops: data migration correctness for any non-trivial seed / staging data.

## Goals / Non-Goals

**Goals:**
- Remove the semantic hack of storing chapter body in `UnitTranslation.description`.
- Eliminate the work/release invariant violation caused by `Unit(type=CHAPTER).workUnitId → Unit(type=BOOK)`.
- Consolidate cover storage into the language-correlated layer (`UnitTranslation.extra`) consistently across `Book`, `Game`, `Media`, `Shelf`, and any future `Post`-kind that wants a cover.
- Deliver the change in one migration so the codebase never has a mixed state where some cover reads go to an extension column and others to translation extra.
- Keep frontend DTO surface stable where possible — consumers continue to read a flat `coverUrl` field on book/media/shelf/game DTOs.

**Non-Goals:**
- Rich-doc / JSON body format for `Post.body`. Body stays `String?` (markdown) and any rich-doc migration is the concern of `editor-core`, not this change.
- Cross-release chapter alignment (i.e., pairing "Chapter 3 of the Chinese release" with "Chapter 3 of the English release"). Chapters remain artifacts of the single release/book they were authored in; `TranslationGroup`-based chapter alignment can be proposed separately later.
- Moving `Link.faviconUrl` or `User.avatar`. These are URL metadata / identity, not language-correlated presentation.
- IMAGE-unit-backed covers. Covers are URL strings; IMAGE `UnitType` stays reserved for posted artwork.
- Promoting `title` to a first-class column on `Post`. Chapter titles (and every other post kind's title) continue to live in `UnitTranslation.title`.

## Decisions

### Decision 1: Chapter is a `PostKind`, not a `UnitType`

Chapter shares every structural property of a post: author, body, target unit, threading, reactions, scoring. A chapter lacks any language-neutral fact that would warrant a dedicated extension table (no ISBN-equivalent, no page count, no platform). The simplest expression is to reuse `Post` with `kind = CHAPTER`.

**Alternatives considered:**

1. *Keep `UnitType.CHAPTER` and add a `Chapter` extension table.* Rejected by the user. Introduces a new 1:1 extension that duplicates what `Post` already offers (body, author, target, threading) and forces parallel feature work (reactions, scoring integration) to be re-wired per-extension.
2. *Use an IMAGE / asset unit indirection for chapter covers.* Rejected on the same grounds as for book/media covers: IMAGE is for first-class image posts.
3. *Invent a chapter-specific parent link (e.g., `Chapter.bookUnitId`).* Post's `targetUnitId` already expresses "this post is about / belongs to this unit" and the chapter-to-book relationship fits that exactly.

### Decision 2: Covers move to `UnitTranslation.extra`, typed by contract

Covers are language-correlated presentation data (translations of a book routinely ship with different cover art). Keeping a `coverUrl` column on each extension table forces a single global image regardless of language, which is wrong in principle and already inconsistent in practice (translations already carry `title`, `subtitle`, `summary`, `description`). `UnitTranslation.extra` is a Json field already present on the model; relocating the cover there costs zero Prisma migration and opens the door to further per-language presentation metadata (`coverAlt`, `blurhash`, `dominantColor`) without more schema churn.

**Alternatives considered:**

1. *Add a dedicated `cover` JSON column on `UnitTranslation`.* Rejected — `extra` already exists for exactly this purpose and the project's `typed-json-fields` pattern codifies how to govern `extra` shapes safely.
2. *Leave cover on extension tables and add per-language variants there.* Rejected — would require inventing a per-language-row-per-extension-table structure, duplicating what `UnitTranslation` already provides.
3. *Store cover on `Unit.extra` instead of `UnitTranslation.extra`.* Rejected — `Unit.extra` is language-neutral; covers are language-correlated.

### Decision 3: `unitTranslationExtraSchema` is a named contract export, with a flat DTO surface

The typed shape of `UnitTranslation.extra` lives in `@rezics/contract` and is imported by server mappers, api client, and frontend readers. DTOs continue to surface a flat `coverUrl` field on `BookDTO`, `MediaDTO`, `ShelfDTO`, `GameDTO`, `ChapterDTO` — consumers do not drill into `extra`. This keeps the contract surface intuitive and localizes the "extra" knowledge to the mapper layer.

### Decision 4: Atomic, one-shot data migration

The migration runs in a single Prisma migration step: read existing `coverUrl` values and chapter units, write the new `UnitTranslation.extra.coverUrl` rows and `Post(kind=CHAPTER)` rows, then drop the old columns and remove `CHAPTER` from `UnitType`. No feature flag, no dual-read transitional phase.

Rationale: backward-compat is not a production concern at this project stage (active pre-launch rework as evidenced by in-flight OpenSpec changes), and a dual-read period doubles the surface area for bugs. One-shot keeps reads simple.

**Alternatives considered:**

1. *Two-phase: ship the new read path first (still reading from columns as fallback), run a data backfill, then drop columns.* Rejected — project has no shipped users, so the cost of dual-read plumbing outweighs the safety benefit.

### Decision 5: `chapter/` server domain survives as a thin wrapper

The `package/server/src/chapter/` module remains the API surface for chapter operations and delegates persistence to `post.service` filtered by `kind = CHAPTER`. Frontend does not see the storage change; `/chapter/*` routes and their DTOs continue to work.

**Alternatives considered:**

1. *Delete the chapter domain and have frontend call `post.service` directly with `kind=CHAPTER` filters.* Rejected — the UX / domain concept of "chapters" is real and stable even if the storage is shared with `Post`. Keeping a thin domain boundary preserves readable call sites.
2. *Merge chapter endpoints into `/post/*` routes.* Rejected on the same grounds: domain boundaries ≠ storage boundaries.

### Decision 6: `BookIndex` remains the authority for chapter order

Chapter Posts do not carry `chapterNumber`, `sortOrder`, or `parentChapterUnitId`. The `BookIndex.index` JSON remains the source of truth for chapter ordering and tree structure. A chapter Post knows which book it belongs to (`targetUnitId`) but not its position within that book.

Rationale: the two systems already coexist cleanly and are well-understood; adding ordering to Chapter would be the over-engineering pattern the user explicitly pushed back on.

### Decision 7: `Unit.workUnitId` on chapters is set to null during migration

Previously migrated chapter units had `workUnitId` pointing to their parent book. That field is reserved for work/release grouping between same-typed units. After migration, chapter posts' parent linkage lives exclusively in `Post.targetUnitId`; the unit's `workUnitId` is nulled to respect the `work-release` invariant.

## Risks / Trade-offs

- **[Risk] Spec drift on `post-kind-contract`.** The existing `post-kind-contract/spec.md` still lists the pre-excerpt-rename enum (`QUOTE` rather than `EXCERPT`), reflecting an older state. The current `post-excerpt-and-unit-resolver` change is the one updating that. → **Mitigation:** This change's `post-kind-contract` delta adds `CHAPTER` on top of the post-rename state and assumes that landing before or alongside this one. The change coordination note is captured in `tasks.md`; if ordering slips, the spec deltas compose regardless because `ADDED Requirements` stack.
- **[Risk] Migration silently loses chapter body if a chapter has no `UnitTranslation` or a mismatched language.** → **Mitigation:** The migration SHALL resolve the chapter's translation via the existing fallback chain (direct → unit default → `"en"` → first available). If none is found, the migration writes an empty `Post.body` and logs the affected unit IDs for audit. The count of missing-translation chapters SHALL be reported before the migration commits.
- **[Risk] Cover URLs differ across a unit's multiple translations post-migration.** Today a unit has one `coverUrl`; the migration writes the same URL to every translation's `extra.coverUrl`, which is correct but subtly different from future editing behavior where each language can diverge. → **Mitigation:** Documented as expected; editorial tooling will surface per-language cover fields once the new storage is in place.
- **[Risk] Frontend code paths that filter by `Unit.type = "CHAPTER"`.** → **Mitigation:** Explicit task to grep for CHAPTER unit-type references and swap them to `kind = "chapter"` filters. `route-cleanup` and `type-flow-migration` already established precedents for this kind of sweep.
- **[Risk] Search index (`@rezics/search`) has documents typed as `CHAPTER`.** → **Mitigation:** Reindex post-deploy is mandatory; task captured in `tasks.md`. The reindex uses the new `type=POST, kind=CHAPTER` projection.
- **[Trade-off] No SQL-level query for "units with a cover".** Reading from `extra` means a raw `coverUrl IS NOT NULL` filter is no longer trivial. → **Mitigation:** Not a production query path today. If needed later, a partial GIN index on `extra->'coverUrl'` is a one-line addition.
- **[Trade-off] Chapter and post share storage.** Product surfaces that treat chapters as "long-form authored content" must be careful not to leak post-style metadata (thread depth, reply counts) into a chapter-reading UI. → **Mitigation:** `chapter/` domain DTOs filter the fields exposed to chapter-facing clients, so the consumer UI does not see irrelevant threading metadata unless it explicitly asks for it.

## Migration Plan

### Order of operations (single Prisma migration)

1. **Add** the new `PostKind.CHAPTER` enum value.
2. **Populate** `Post` rows for every `Unit` with `type = CHAPTER`:
   - `unitId` = same
   - `authorUserId` = `Unit.userId`
   - `kindKey` = `"chapter"` (and `kind = CHAPTER`)
   - `targetUnitId` = prior `Unit.workUnitId`
   - `body` = resolved chapter translation's `description` (fallback chain as per `unit-translation` spec)
   - other Post fields default
3. **Change** `Unit.type` from `CHAPTER` to `POST` for every chapter unit; **null out** `Unit.workUnitId` on those rows.
4. **Clear** `UnitTranslation.description` for migrated chapter units (optional; retaining is allowed but writes to body must no longer resolve from `description`).
5. **Copy** every non-null `coverUrl` from `Book`, `Game`, `Media`, `Shelf` into `UnitTranslation.extra.coverUrl` for every translation row of the corresponding unit. If a unit has no translations, create a translation row using the unit's `defaultLanguage` (or the platform fallback `"en"` if `defaultLanguage` is null).
6. **Drop** the `coverUrl` columns from `Book`, `Game`, `Media`, `Shelf`.
7. **Remove** `CHAPTER` from the `UnitType` enum.

### Rollback strategy

Rollback is not trivial because enums are destructively altered. The migration SHALL be run only after the code deploy is green and seed data has been re-verified on staging. If a fatal issue is discovered post-migration:

- **Code-level bugs:** fix forward. The new schema is the target state; we do not roll back to the old schema.
- **Data-level corruption:** restore from the pre-migration snapshot (standard operational backup). The migration SHALL be bracketed by an explicit snapshot step in the deploy runbook.

### Verification checklist (pre-commit of migration)

- Count of `Unit(type=CHAPTER)` rows matches count of newly-created `Post(kind=CHAPTER)` rows.
- Every chapter Post has non-null `targetUnitId` pointing to a valid BOOK unit.
- Count of non-null `coverUrl` values across Book/Game/Media/Shelf matches count of `UnitTranslation.extra.coverUrl` values written (modulo multi-translation fan-out).
- Prisma introspection confirms the four `coverUrl` columns are dropped and `CHAPTER` is absent from `UnitType`.
- `@rezics/search` reindex finishes without errors.

## Open Questions

- **Chapter URL pattern in `buildUrl`.** Two reasonable options: `/chapter/:id` (flat, symmetric with `/review/:id`, `/remark/:id`) or `/book/:bookId/chapter/:id` (nested, reflects the chapter-belongs-to-book semantic). Frontend team to choose; recorded in `tasks.md` as a decision to be made during implementation.
- **Should `editor-core` be notified that `Post.body` is now also a chapter-body carrier?** A future Json-rich-doc migration would touch every post kind, chapters included. Coordination needed but out of scope for this change.
- **Does the `infra-seed` pipeline or any Meilisearch index template hard-code `CHAPTER` as a separate doc type?** Needs a grep sweep during implementation; if so, those templates must be updated as part of the task for seed / search alignment.
