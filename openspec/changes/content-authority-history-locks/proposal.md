## Why

Rezics is moving from owner-only catalog editing toward wiki-style collaborative maintenance, but current ownership and history semantics collapse too many meanings into `Unit.userId`: creator, custodian, editor, and authority. This change establishes one coherent model for wiki ownership, sparse field locks, Unit collaborators, wiki posts, and history capture without introducing a separate wiki-only object system.

The change is needed before community editing becomes broad: BOOK, ENTITY, GAME, MEDIA, and future wiki posts all need a safe boundary between owner authority and community edits, and history must be reliable enough to audit and recover collaborative changes.

## Problem

- `Unit.userId` currently grants owner semantics to whoever first creates a row, which is wrong for community catalog entries such as public books, authors, publishers, games, and media.
- `UnitType` is not enough to decide editability: a BOOK may be a community catalog book or an author's own work, so runtime permission gates must not infer community edit rights from type alone.
- A wiki-owned Unit may still need protected fields. The lock table must be the runtime source of truth for whether a field is blocked from community edits.
- Ordinary posts should remain author-owned and non-collaborative; only an explicit future `Post.kind = WIKI` surface should enter collaborative edit/history behavior.
- History should be an independent service boundary, but canonical main-server writes must not rely on a future CDC or external queue facility to avoid dual-write loss.

## Goals

- Seed ordinary infra users for `rezics` and `rezics-wiki`; both are `User` + `Unit(type=USER)` records with no login credentials.
- Treat `rezics-wiki` as the custodian owner for community catalog and wiki content created by ordinary users through wiki creation surfaces.
- Add sparse Unit authority tables for collaborators and field locks, with locks as the runtime fact source for protected fields.
- Ensure runtime edit admission uses actor permission, `Unit.userId`, Unit collaborators, endpoint policy, and lock rows, not `UnitType` or owner identity as an automatic community-edit shortcut.
- Add a history service package with its own Prisma schema and API surface, fed by a main-DB transactional outbox written in the same transaction as canonical mutations.
- Add wiki post support using existing Unit/Post primitives, not a separate wiki-page model.
- Update frontend and API clients so ordinary users can create `rezics-wiki` owned catalog entries and wiki posts through explicit wiki-mode flows.

## Non-goals

- No real-time collaborative editing, presence, CRDT, or conflict-free multi-cursor editor.
- No CDC, Kafka, Debezium, or external queue dependency in v1.
- No separate wiki rendering path or separate wiki actor taxonomy.
- No automatic broad migration of existing development rows to `rezics-wiki`.
- No moderation review queue, semantic diff UI, or cherry-pick revert workflow in v1.
- No community edit admission for ordinary `POST`, `REVIEW`, `REMARK`, `REPLY`, `EXCERPT`, or `CHAPTER` content unless explicitly included by a wiki-capable surface.

## What Changes

- Add server seed infrastructure for `rezics` and `rezics-wiki` system users.
- Add `UnitCollaborator` as a per-Unit delegated authority table.
- Add `UnitFieldLock` as a sparse field lock table with `fieldKey = "*"` support for whole-object locks.
- Add a shared server-side authority helper that gates collaborative field edits using:
  - platform admin/root override;
  - primary owner `Unit.userId`;
  - `UnitCollaborator` role;
  - endpoint-level collaborative edit eligibility;
  - `UnitFieldLock` rows for `["*", ...changedFieldKeys]`.
- Add creation-mode inputs on wiki-capable create APIs. `creationMode = "wiki"` stamps `Unit.userId = rezics-wiki`, while personal flows keep the current user as owner.
- Add `Post.kind = WIKI` and route it through collaborative Unit edit/history behavior; ordinary posts keep existing author-only semantics.
- Add `package/history` as an independent service workspace with Prisma schema, revision/event storage, and read APIs.
- Add a main-server `HistoryOutbox` table written in the same transaction as canonical content changes so history service persistence is reliable without CDC or an external queue.
- Add history API clients in `package/api` and frontend history/wiki creation surfaces in `package/app`.
- Add admin surfaces for field locks, collaborators, and history inspection where needed to bootstrap moderation workflows.

## Scope

This change covers the first end-to-end implementation of authority, locks, history capture, and wiki posts. It intentionally includes backend schema, contract/API, service, and frontend work because each layer depends on the same runtime rule: creation mode sets initial ownership/locks, while runtime edit admission is driven by owner/collaborator/lock facts.

## Capabilities

### New Capabilities

- `content-authority`: Defines Unit ownership, `rezics`/`rezics-wiki` infra users, Unit collaborators, sparse field locks, field vocabulary, and runtime collaborative edit admission.
- `content-history-service`: Defines the independent history service, main-server transactional outbox, revision/event storage, sequence guarantees, and history read APIs.
- `wiki-content-creation`: Defines wiki-mode creation flows for catalog content and entities, including ordinary-user creation of `rezics-wiki` owned Units.
- `wiki-post-editing`: Defines `Post.kind = WIKI`, wiki post creation/edit permissions, body history, and the boundary between ordinary posts and wiki posts.

### Modified Capabilities

- None.

## Impact

- Affected packages:
  - `package/server`: Prisma schema changes, seed data, permission helpers, creation-mode handling, field-lock checks, history outbox writes, and main-proxy write APIs.
  - `package/history`: New independent Elysia/Prisma service for revision/event persistence and history read APIs.
  - `package/contract`: New DTOs, schemas, enums, field-key vocabularies, PostKind addition, history API contracts, and authority contracts.
  - `package/api`: API clients and React Query hooks for authority, locks, collaborators, wiki creation, wiki posts, and history reads.
  - `package/app`: Book/entity/wiki creation surfaces, wiki post editor, history timeline UI, lock/collaborator affordances where needed, and rendering rules for `rezics-wiki` owned content.
  - `package/admin`: Administrative lock/collaborator/history inspection and override surfaces.
- Dependencies:
  - Adds a new Bun workspace package for `@rezics/history`.
  - Adds a new history Prisma schema/database connection.
  - Does not add CDC, Kafka, Debezium, or external queue infrastructure.
- Compatibility:
  - Existing ordinary posts remain author-owned and non-collaborative.
  - Existing owner-only edit flows continue to work until migrated to field-aware authority helpers.
  - Existing catalog rows are not backfilled automatically; v1 forward behavior applies to new wiki-mode creations.
- Migration:
  - Seed `rezics` and `rezics-wiki` users before enabling wiki-mode creation.
  - Add whole-object locks to personal-mode creations where community editing should be closed by default.
  - Incrementally route mutation endpoints into history outbox after their snapshot/event payload builders are ready.
