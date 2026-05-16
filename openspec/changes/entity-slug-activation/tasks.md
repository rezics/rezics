## 1. Contract DTOs

- [ ] 1.1 Add `EntityDTO`, `CreateEntityInput`, `UpdateEntityInput`, `EntityListQuery` typebox schemas in `package/contract/src/entity/` (per `entity-unit-type` requirements; the schemas were specified but not yet exported).
- [ ] 1.2 Re-export the new schemas through `@rezics/contract` barrel.
- [ ] 1.3 Verify `package/contract` builds without type errors.

## 2. Server — EntityService and routes

- [ ] 2.1 Create `package/server/src/entity/entity.types.ts` with internal Prisma-shaped types (no leaking of generated client types across packages).
- [ ] 2.2 Create `package/server/src/entity/entity.mapper.ts` projecting Prisma rows to `EntityDTO`, flattening UnitTranslation rows.
- [ ] 2.3 Create `package/server/src/entity/entity.service.ts` implementing `create`, `get`, `update`, `delete`, `list`. Use a single Prisma transaction for create (Unit + Entity + translations) and update (Entity + Unit + translations). Always stamp `Unit.userId = caller.unitId` on create. Mirror the admin-only-after-verified slug gate at the service layer.
- [ ] 2.4 Locate the ENTITY-slug rejection guard introduced by `user-namespace-slug` and remove it; replace with a no-op (the gate now lives in `entity.service.ts`).
- [ ] 2.5 Create `package/server/src/entity/entity.api.ts` exposing `POST /entity`, `GET /entity/:unitId`, `GET /entity/by-slug/:slug`, `PATCH /entity/:unitId`, `DELETE /entity/:unitId`, `GET /entity`. Each route binds the contract typebox schemas.
- [ ] 2.6 Mount the entity API in `package/server/src/index.ts` via `.use(entityApi)`.
- [ ] 2.7 Verify `package/server` builds and `bun test` passes (no new tests required in this step; the existing suite must not regress).

## 3. Server — Meili entity index

- [ ] 3.1 Add `entities` index creation in `package/server/prisma/seed/init-meili-search.ts` with `searchableAttributes: ["titles.value", "slug"]`, `filterableAttributes: ["kind", "verified"]`.
- [ ] 3.2 Add index sync calls in `entity.service.ts` create/update/delete paths (post-commit, mirroring the existing Meili sync pattern used by other unit-type services).
- [ ] 3.3 Add a small reconciler script entry (one-shot CLI) under `package/server/prisma/factory/` or equivalent to backfill the `entities` index on a fresh DB, mirroring the existing pattern for other indexed types.

## 4. Server — tests

- [ ] 4.1 Add `entity.service.test.ts` covering: create+get round-trip, update kind, delete cascade (Unit + Entity + translations + attribution), list with kind filter, slug rejection for non-admin, slug rejection for admin on unverified, slug acceptance for admin on verified, verified toggle admin-only, verified revoke preserves slug, search index sync on create/delete.
- [ ] 4.2 Add `entity.api.test.ts` covering route surface, body validation, and admin permission boundaries.
- [ ] 4.3 Verify `bun test` passes across `package/server`.

## 5. Frontend API hooks

- [ ] 5.1 Add `package/api/src/entity/` with TanStack Query options + hooks for `useEntity(unitId)`, `useEntityBySlug(slug)`, `useEntityList(query)`, `useEntitySearch(query)` (Meili-backed for the picker), `useCreateEntity`, `useUpdateEntity`, `useDeleteEntity`.
- [ ] 5.2 Re-export through `@rezics/api` barrel.
- [ ] 5.3 Verify `package/api` builds.

## 6. UI — Entity detail page

- [ ] 6.1 Add shared `EntityDetailPage` component in `package/app/src/entity-detail/` following the project's feature-layered structure (`models/`, `hooks/`, `components/`, `sections/`, `pages/`, `index.ts`).
- [ ] 6.2 Implement Hero region: primary title (language-aware), kind chip, verified `BadgeCheck` icon, language switcher when ≥2 translations exist.
- [ ] 6.3 Implement tab strip with live `Overview`, `Works`, `About` tabs; skip tabs whose data source returns empty (no static kind→tab mapping).
- [ ] 6.4 Implement `Awards` and `News` tab components, commented out with `/* AWARDS_TAB: … */` and `/* NEWS_TAB: … */` markers; also comment their entries in the tab registration array.
- [ ] 6.5 Confirm no owner card, no subscribe button, and no DOM nodes reserved for either (preserves future additive-only insertion).
- [ ] 6.6 Add the route `/e/$slug` at `package/app/src/routes/e.$slug.tsx` — resolves slug via `useEntityBySlug`, renders `EntityDetailPage` with the resolved unitId.
- [ ] 6.7 Add the route `/entity/$unitId` at `package/app/src/routes/entity.$unitId.tsx` — renders `EntityDetailPage` directly.
- [ ] 6.8 Add a 404 state for unknown slugs and unknown unitIds.

## 7. UI — EntityPicker composite

- [ ] 7.1 Add `EntityPicker` composite under `package/ui/src/composite/EntityPicker/` (or in `package/app` if it stays consumer-app-scoped; final placement per design.md / rezics-design skill review).
- [ ] 7.2 Implement Dialog-hosted command palette: search input, debounced Meili query via `useEntitySearch`, result list with title / kind chip / verified badge.
- [ ] 7.3 Implement sticky "+ Create new" affordance with inline mini-form (one translation + kind; bio omitted).
- [ ] 7.4 Wire inline create to `useCreateEntity`; on success invoke `onSelect(newUnitId)` and close Dialog.
- [ ] 7.5 Implement `kindHint` prop wiring (pre-fill inline form kind; Meili filter weight).
- [ ] 7.6 Confirm no slug input is rendered or submitted from any path within the picker.
- [ ] 7.7 Add a Storybook story for `EntityPicker` under `package/ui/src/composite/EntityPicker/` (mock the search hook).

## 8. UI — /me/entities self-claim

- [ ] 8.1 Add `/me/entities` route rendering a list of entities where `Unit.userId === currentUser.unitId`, using `useEntityList({ ownerUnitId: currentUser.unitId })` (extend `EntityListQuery` if needed).
- [ ] 8.2 Add empty-state CTA pointing to `/me/entities/new`.
- [ ] 8.3 Add `/me/entities/new` route with a creation form (one translation + kind; no slug input).
- [ ] 8.4 On submit, call `useCreateEntity`; on success navigate to `/entity/$newUnitId`.
- [ ] 8.5 Add "Entities" entry to the `/me/settings` left-rail navigation (locate the sidebar config and add the link); confirm it does NOT appear in the main avatar dropdown.

## 9. Admin — /admin/entities curation

- [ ] 9.1 Add `/admin/entities` route in `package/admin` rendering a paginated index with columns: unitId, primary title, kind, verified, slug, createdAt.
- [ ] 9.2 Wire filters: by `verified`, by `kind`, and free-text search across translation titles (Meili-backed).
- [ ] 9.3 Add `/admin/entities/$unitId` edit page with: `verified` toggle, `slug` input (disabled when `verified = false`), translation editor reusing the existing pattern.
- [ ] 9.4 Wire client-side slug validation using `validateSlug` from `@rezics/contract`; disable submit until valid or empty.
- [ ] 9.5 Confirm non-admin access to either route returns the standard admin forbidden state.

## 10. Documentation & plan hygiene

- [ ] 10.1 Update `openspec/plans/shelf-and-user-namespace-slug-plan.md` §6.2 to drop the "Hard dependency on `wiki-content-ownership` / `content-creation-mode`" sentence; replace with a one-line note that wiki convention is deferred (decision 2026-05-16) and v1 entities are creator-owned.
- [ ] 10.2 Update §8 sequence in the same plan: remove the "after #4 ships" annotation on `entity-slug-activation` and mark #4 (`content-creation-mode`) as deferred until paired with `content-history-and-lock`.
- [ ] 10.3 Update `openspec/plans/wiki-content-ownership-plan.md` with a "Status update 2026-05-16" header note: deferred until paired with history-infrastructure; ships with its first enforced UI surface.

## 11. End-to-end verification

- [ ] 11.1 `bun run check:convention` passes across the repo.
- [ ] 11.2 `bun run knip` clean on changed packages.
- [ ] 11.3 `bun test` passes in `package/server`, `package/api`, `package/contract`.
- [ ] 11.4 Manual walkthrough: seed dev DB, log in as a regular user, create a personal entity via `/me/entities/new`, verify it renders at `/entity/$unitId`, attempt to set slug via API (should be rejected), log in as admin, navigate to `/admin/entities/$unitId`, toggle `verified`, set slug, verify `/e/$slug` resolves.
- [ ] 11.5 Manual walkthrough: open a book creation flow, embed EntityPicker (temporary scaffold if no consumer ships in this change), search → no results → inline create → verify entity appears in `/me/entities` of the creator.
