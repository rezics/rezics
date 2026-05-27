## 1. Contract Surface

- [x] 1.1 Add `AiDisclosureMode` constants, type, and TypeBox schema to `package/contract/src/unit.ts`.
- [x] 1.2 Add an optional AI disclosure details schema/type in `package/contract/src/unit.ts` or a dedicated contract module if the shape is reused.
- [x] 1.3 Add `aiDisclosureMode` and optional details fields to Unit-facing DTO schemas in `package/contract/src/unit.ts`.
- [x] 1.4 Add matching fields to Book/chapter/content DTO schemas only where they already expose Unit-level metadata.
- [x] 1.5 Add or update contract tests that verify accepted enum values and reject unsupported disclosure modes/details.

## 2. Persistence and Server Mapping

- [x] 2.1 Add the Prisma enum and Unit persistence field for AI disclosure mode with default `UNKNOWN`.
- [x] 2.2 Decide and implement the storage location for optional details, either a dedicated Unit-owned JSON field or a strictly validated Unit metadata subshape.
- [x] 2.3 Add a migration that backfills existing Units to `UNKNOWN`.
- [x] 2.4 Update Unit create/update service inputs and validators to accept valid disclosure modes and optional details.
- [x] 2.5 Update Unit mappers so detail/list responses include the persisted disclosure fields.
- [x] 2.6 Update Book and chapter mappers/services where they mirror Unit metadata.
- [x] 2.7 Add server tests for default creation, explicit updates, invalid values, and independence from `rating`.

## 3. Search and Indexing

- [x] 3.1 Add AI disclosure mode to Meilisearch/content index contract documents if search results need display or filtering.
- [x] 3.2 Update search sync mapping from Unit rows to include `aiDisclosureMode`.
- [x] 3.3 Add explicit AI disclosure filter handling separate from rating filters if filtering ships in this change.
- [x] 3.4 Add search/index tests proving AI disclosure filtering does not modify allowed-rating derivation.

## 4. Frontend UI

- [x] 4.1 Add shared labels for each disclosure mode using the app localization pattern.
- [x] 4.2 Add a compact AI disclosure badge or metadata display in Unit/Book surfaces that already show rating/license metadata.
- [x] 4.3 Add an editor control for maintainers in existing Unit/Book metadata edit flows.
- [x] 4.4 Keep UI copy and styling separate from `RatingBadge`/`RatingSelector` semantics.
- [x] 4.5 Add Storybook coverage or focused component tests for badge/selector states if shared UI components are introduced.

## 5. Validation

- [x] 5.1 Run targeted contract tests for Unit/Book schema changes.
- [x] 5.2 Run targeted server tests for Unit and Book metadata persistence/mapping.
- [x] 5.3 Run targeted frontend tests or Storybook checks for edited UI surfaces.
- [x] 5.4 Run `bun run check:convention` and `bun run format:check`.
- [x] 5.5 Grep for duplicated AI disclosure literals and replace internal callsites with shared contract exports.
