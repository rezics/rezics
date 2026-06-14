---
title: Remove Shelf Kind Key
status: done
created: 2026-06-14
completed: 2026-06-14
supersededBy:
tags: [shelf, contract, server, api, app, schema]
---

## Why

`Shelf.kindKey` no longer carries a distinct shelf model. Progress shelves
(`saved`, `backlog`, `active`, `completed`) are being removed, and the remaining
platform shelf, `favorites`, is already addressable as a reserved shelf
`Unit.slug` under the owning user's slug scope. Keeping `kindKey` creates a
second identity path for the same thing, lets fixture-only values leak into the
runtime contract, and caused UI crashes when arbitrary shelf kind strings were
treated as system labels.

Cut shelves over to the simpler model: a shelf is a `Unit(type=SHELF)` with
optional reserved slug identity, pinned tags for shelf-level semantics, `extra`
for display/view preferences, and `ShelfItem` rows for contents. A user's
favorites shelf is rendered first in their shelf list and does not enter the
ordinary sorting flow.

## Durable constraints & decisions

- (type) Remove `Shelf.kindKey` from schema, contract DTOs, create/update inputs,
  list filters, server mappers, API clients, and app surfaces. There is no
  compatibility path for old `kindKey` data.
- (type) Reserved shelf identity is represented by `Unit.slug` plus
  `Unit.slugScope`; after this cutover the only reserved shelf slug is
  `"favorites"`.
- (comment) Favorites is a platform-minted reserved shelf slug, not a user
  supplied shelf property. Bootstrap/ensure code bypasses user slug validation
  only because the platform is writing a known reserved value.
- (test) Favorites lookup, toggle, and recovery use
  `(Unit.type = SHELF, Unit.slug = "favorites", Unit.slugScope = userId)`;
  no code path may read or write `Shelf.kindKey` for this.
- (test) User-created shelves cannot claim the reserved favorites slug. Ordinary
  shelf identity is the Unit id; public/custom shelf slugs remain governed by
  the existing custom slug policy.
- (test) User shelf lists render the favorites shelf first when present, then
  apply ordinary sort/search/pagination behavior to the remaining shelves.
  Favorites does not move because of sort order.
- (test) Shelf title rendering uses translations and the normal untitled
  fallback. App components do not derive display copy from a shelf kind label.
- (type) Shelf Unit pinned tags remain the mechanism for shelf-level semantic
  classification. Removing `kindKey` does not change shelf item membership,
  pinned tags, or item metadata.

## Tasks

## 1. Contract And Reserved Slug Model

- [x] 1.1 Remove `kindKey` from `ShelfDTO`, `ShelfSummaryDTO`,
  `ShelfDetailDTO` inheritance, `ShelfListQuery`, `ShelfListBody`,
  `CreateShelfInput`, and `UpdateShelfInput` in
  `package/contract/src/shelf/shelf.ts`.
- [x] 1.2 Remove `SYSTEM_SHELF_KIND_KEYS`, `systemShelfKindKeySchema`, and
  `SystemShelfKindKey` from `package/contract/src/shelf/progress.ts`; keep
  progress status types independent from shelves.
- [x] 1.3 Replace `SYSTEM_SHELF_SLUGS` with a single reserved favorites slug
  contract in `package/contract/src/slug/system-slugs.ts`, and update reserved
  slug exports/tests accordingly.
- [x] 1.4 Replace system-shelf ensure contract fields from `kindKey` to reserved
  slug terminology in `package/contract/src/shelf/system-shelves.ts`, or delete
  the generic ensure body if the implementation exposes a favorites-only ensure
  route.
- [x] 1.5 Update contract tests that assert old system shelf key arrays,
  labels, and ensure payload validation.

## 2. Database Schema And Migration

- [x] 2.1 Remove `kindKey` from `package/server/src/db/schema/shelf.ts`.
- [x] 2.2 Generate a Drizzle migration for dropping `"Shelf"."kindKey"` with
  `task db:generate`; do not hand-author the ordinary drop migration.
- [x] 2.3 Review generated migration and snapshots to confirm only the intended
  shelf column change landed.

## 3. Server Shelf Domain

- [x] 3.1 Rename/rework `package/server/src/shelf/system-shelves.ts` from
  kind-key APIs to reserved-slug APIs: `findReservedShelfBySlug`,
  `ensureReservedShelf`, and `bootstrapReservedShelves`.
- [x] 3.2 Make reserved shelf creation write only the `Unit` slug fields and the
  plain `Shelf` extension row; do not write a shelf kind.
- [x] 3.3 Limit bootstrap to the favorites shelf and remove bootstrap creation
  of `saved`, `backlog`, `active`, and `completed`.
- [x] 3.4 Update `package/server/src/shelf/shelf-item-action.service.ts` so
  favorite toggle/status lookup uses `FAVORITES_SHELF_SLUG` and reserved slug
  lookup.
- [x] 3.5 Change missing favorites errors from `{ kindKey: "favorites" }` to
  `{ slug: "favorites" }`, and update server/API recovery parsing.
- [x] 3.6 Remove `kindKey` filtering, create/update assignment, and reserved
  kind rejection from `package/server/src/shelf/shelf.service.ts`.
- [x] 3.7 Update `package/server/src/shelf/shelf.mapper.ts` and shelf selected
  types so DTO mapping no longer projects `kindKey`.
- [x] 3.8 Update server tests for favorites slug lookup, ensure/bootstrap,
  favorite toggle missing-shelf recovery, shelf create/update, and list behavior.

## 4. API Client And Hooks

- [x] 4.1 Replace `useSystemShelfRef(kindKey)` with reserved slug/favorites
  terminology in `package/api/src/slug/useSystemShelfRef.ts`, or collapse it to
  a favorites-specific hook if no generic reserved shelf hook remains useful.
- [x] 4.2 Update `useEnsureSystemShelf`, `useSystemShelfRecovery`, related query
  keys, and tests so they consume `{ slug: "favorites" }` recovery details.
- [x] 4.3 Remove `kindKey` from shelf API request/response types and query
  builders in `package/api/src/shelf/*`.
- [x] 4.4 Update API tests that expect shelf `kindKey` URLs, payloads, recovery
  details, or DTO shapes.

## 5. App UI

- [x] 5.1 Delete shelf kind label helpers from
  `package/app/src/shelf/models/systemShelfLabel.ts` and update exports.
- [x] 5.2 Update `ShelfPickerVirtualList`, `ShelfCard`, `SingleShelf`, and
  `FeedShelfCard` to use translation title plus untitled fallback, with no kind
  label rendering.
- [x] 5.3 Remove kind chip/filter UI from
  `package/app/src/user/sections/ShelvesTabSection.tsx`.
- [x] 5.4 Add a small shelf-list ordering helper near the user shelves feature:
  split favorites by `shelf.slug === "favorites"`, keep it first, and sort/filter
  ordinary shelves through the existing flow.
- [x] 5.5 Update app tests/stories/fixtures that pass `kindKey` on shelf DTOs.
- [x] 5.6 Keep user-facing copy changes routed through `@rezics/i18n`; delete
  obsolete shelf kind label keys only if they have no remaining consumers.

## 6. Seed And Factory Data

- [x] 6.1 Remove `SHELF_KIND_KEYS` and generated ordinary shelf `kindKey` values
  from `package/server/src/db/factory/data.ts` and shelf factories.
- [x] 6.2 Update engagement/favorites seed paths to create favorites through the
  reserved slug model only.
- [x] 6.3 Clean scenario fixtures that currently write `showcase`,
  `factory-complex`, `CUSTOM`, `PLAYLIST`, `READING_LIST`, `WATCHLIST`, or
  `FAVORITES` into `Shelf.kindKey`.
- [x] 6.4 Update factory and seed tests to assert reserved slug identity instead
  of shelf kind.

## 7. Verification

- [x] 7.1 Run focused contract, server shelf, API shelf, and app shelf tests.
- [x] 7.2 Run `task check:convention`.
- [x] 7.3 Run `task test` if the focused suite passes and runtime allows.
- [x] 7.4 Run `task check:i18n` if app locale keys are removed or renamed.
- [x] 7.5 Verify the original shelf picker crash path no longer references
  `SYSTEM_SHELF_KIND_LABEL` or any shelf kind label lookup.

## Out of scope

- Reworking `ShelfItem.kind`, `itemType`, parent roles, or item metadata.
- Changing shelf pinned tag semantics or the `/:unitId/pinned-tags` API.
- Adding compatibility reads for legacy `Shelf.kindKey` values.
- Reopening custom public shelf slug activation; keep the existing custom slug
  policy unless a separate plan changes it.
- Redesigning progress tracking. Progress statuses may remain in the progress
  domain, but they no longer imply system shelves.
