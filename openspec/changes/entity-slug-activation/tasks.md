## 1. Contract DTOs

- [x] 1.1 Add `EntityDTO`, `CreateEntityInput`, `UpdateEntityInput`, `EntityListQuery` typebox schemas in `package/contract/src/entity/` (per `entity-unit-type` requirements; the schemas were specified but not yet exported).
- [x] 1.2 Re-export the new schemas through `@rezics/contract` barrel.
- [x] 1.3 Verify `package/contract` builds without type errors.

## 2. Server — EntityService and routes

- [x] 2.1 Create `package/server/src/entity/entity.types.ts` with internal Prisma-shaped types (no leaking of generated client types across packages).
- [x] 2.2 Create `package/server/src/entity/entity.mapper.ts` projecting Prisma rows to `EntityDTO`, flattening UnitTranslation rows.
- [x] 2.3 Create `package/server/src/entity/entity.service.ts` implementing `create`, `get`, `update`, `delete`, `list`. Use a single Prisma transaction for create (Unit + Entity + translations) and update (Entity + Unit + translations). Always stamp `Unit.userId = caller.unitId` on create. Mirror the admin-only-after-verified slug gate at the service layer.
- [x] 2.4 Locate the ENTITY-slug rejection guard introduced by `user-namespace-slug` and remove it; replace with a no-op (the gate now lives in `entity.service.ts`).
- [x] 2.5 Create `package/server/src/entity/entity.api.ts` exposing `POST /entity`, `GET /entity/:unitId`, `GET /entity/by-slug/:slug`, `PATCH /entity/:unitId`, `DELETE /entity/:unitId`, `GET /entity`. Each route binds the contract typebox schemas.
- [x] 2.6 Mount the entity API in `package/server/src/index.ts` via `.use(entityApi)`.
- [x] 2.7 Verify `package/server` builds and `bun test` passes (no new tests required in this step; the existing suite must not regress).

## 3. Server — Meili entity index

- [x] 3.1 Add `entities` index creation in `package/server/prisma/seed/init-meili-search.ts` with `searchableAttributes: ["titles", "summaries", "slug"]`, `filterableAttributes: ["kind", "verified", "ownerUnitId"]`. (Searchable adjusted from spec's `titles.value` to flattened `titles[]` to match the pattern used by every other Meili index in the repo.)
- [x] 3.2 Add index sync calls in `entity.service.ts` create/update/delete paths (post-commit, mirroring the existing Meili sync pattern used by other unit-type services).
- [x] 3.3 Add a one-shot reconciler script at `package/search/src/bin/backfill-entities.ts` that calls `syncAllEntities(client)` and is documented for `bun run` invocation.

## 4. Server — tests

- [x] 4.1 Add `entity.service.test.ts` covering: create with caller as owner, non-admin slug rejection, non-admin verified rejection, admin slug rejection on unverified, admin slug acceptance when verified=true in same payload, admin slug acceptance on already-verified entity, verified revoke preserves slug, non-admin kind update succeeds, delete + Meili sync, list with kind filter, list with ownerUnitId filter, getBySlug 404 paths. (Delete cascade verified via the parent Unit deletion call — full DB cascade is enforced by the Prisma schema's `onDelete: Cascade` on Entity, UnitTranslation, and Attribution.)
- [x] 4.2 Add `entity.api.test.ts` covering route surface (by-slug, by-unitId, list, POST validation), body validation, slug rejection bubbling to 403, and admin-only DELETE.
- [x] 4.3 Verified the entity test suite passes; no new failures in the broader `bun test` suite vs. baseline (45 pre-existing failures unchanged).

## 5. Frontend API hooks

- [x] 5.1 Add `package/api/src/entity/` with TanStack Query options + hooks: `useEntity(unitId)`, `useEntityBySlug(slug)`, `useEntityList(query)`, `useEntitySearch(query)` (backed by `GET /entity?q=` in v1 — Meili-backed picker upgrade is a transparent server-side swap; consumer signature unchanged), `useCreateEntity`, `useUpdateEntity`, `useDeleteEntity`.
- [x] 5.2 Re-export through `@rezics/api/entity` subpath (mirrors `@rezics/api/shelf`, `@rezics/api/notification`). Added the explicit `./entity` export to `package/api/package.json` so deep imports resolve to `./src/entity/index.ts`.
- [x] 5.3 `bunx tsc --noEmit` on `package/api` returns 0 errors.

## 6. UI — Entity detail page

- [x] 6.1 Added shared `EntityDetailPage` at `package/app/src/entity-detail/` with `models/`, `hooks/`, `components/`, `sections/`, `pages/`, `index.ts`.
- [x] 6.2 Hero region: primary title (language-aware), kind chip, `BadgeCheck` icon for verified, language switcher when ≥2 translations.
- [x] 6.3 Tab strip with live `Overview` / `Works` / `About` tabs; each tab is filtered out of the tablist when its data source is empty. Works tab uses a `// MOCK:` hook (`useEntityWorks`) that returns `[]` until a real `attribution.byEntity` endpoint is exposed.
- [x] 6.4 `Awards` and `News` tab components shipped as block-commented placeholders with `/* AWARDS_TAB: … */` and `/* NEWS_TAB: … */` markers in both the import area, the `tabs[]` registration, and the `TabsContent` JSX block.
- [x] 6.5 No owner card, no subscribe button rendered anywhere in `EntityDetailPage`. No reserved DOM nodes — additive only when those surfaces land.
- [x] 6.6 Route `/e/$entitySlug` (existing file `package/app/src/routes/_mainLayout/e/$entitySlug.tsx`) updated from "always 404" to: resolve slug via `entityBySlugQueryOptions`, then render `EntityDetailPage` with the resolved unitId.
- [x] 6.7 Route `/entity/$unitId` added at `package/app/src/routes/_mainLayout/entity/$unitId/index.tsx`. Validates UUID shape via `isPublicUnitIdRouteParams`, then renders `EntityDetailPage`.
- [x] 6.8 Both routes throw `notFound()` when the slug / unitId fails to resolve (or the server returns 404 for non-ENTITY units). The `EntityDetailPage` component also renders an inline "Entity not found" surface as a safety net.

## 7. UI — EntityPicker composite

- [x] 7.1 `EntityPicker` lives at `package/app/src/entity-picker/` (consumer-app-scoped, per design.md placement option). Depends on `@rezics/api/entity` which would force `@rezics/ui` → `@rezics/api` for a ui-side placement; the picker is composed of shadcn `Dialog`+`Input` plus the `EntityResultRow` / `EntityInlineCreateForm` primitives, so no ui-side primitive is needed.
- [x] 7.2 Dialog-hosted search palette: debounced (`useDebouncedValue`) `useEntitySearch` query, result rows show primary title + kind chip + `BadgeCheck` icon.
- [x] 7.3 Sticky "+ Create new" affordance opens the inline `EntityInlineCreateForm` with required fields = one translation (language + title) + kind. No bio.
- [x] 7.4 Inline form calls `useCreateEntity`; `onSuccess` invokes `onSelect(newUnitId)` and closes the Dialog.
- [x] 7.5 `kindHint` prop wires the inline form's `kind` default and soft-sorts matching kinds first in the result list (preserves "preferred but not exclusive" filter weight semantics).
- [x] 7.6 No slug field in the picker. The `CreateEntityInput` payload omits `slug` everywhere within the composite.
- [x] 7.7 Storybook story at `package/app/src/entity-picker/components/EntityPicker.stories.tsx` mocks the search hook via a hosted `QueryClient` with a `queryFn` that always resolves to the same fixture entity list. Stories: Default, WithPersonHint, WithStudioHint.

## 8. UI — /me/entities self-claim

- [x] 8.1 Route `/user/me/entities` added at `package/app/src/routes/_mainLayout/user/me/entities/index.tsx`. Lists entities filtered via `useEntityList({ ownerUnitId: currentUser.unitId })`. (`EntityListQuery` already exposed `ownerUnitId`; no contract extension needed.)
- [x] 8.2 Empty state renders a centered card with a "Declare an entity" primary CTA pointing to `/user/me/entities/new`.
- [x] 8.3 Route `/user/me/entities/new` added at `package/app/src/routes/_mainLayout/user/me/entities/new.tsx`. Form requires one translation (language + title) + kind. No slug input.
- [x] 8.4 Submit calls `useCreateEntity`; on success navigates to `/entity/$newUnitId` (newly created entities have no slug, so the unitId route is the only addressable surface).
- [x] 8.5 "Entities" entry added to `SettingsSidebar` in a new `EXTRA_NAV` block (visually separated from the in-settings nav). Links to `/user/me/entities` (jumps out of the settings shell). Not added to `MainLayout`'s avatar dropdown or top-level navigation, per spec rationale ("most users will never declare an entity"). The mobile `SettingsTabBar` continues to render only `SETTINGS_NAV`, so the entity entry is desktop-sidebar-only by design.

## 9. Admin — /admin/entities curation

- [x] 9.1 Route `/admin/entities` added at `package/admin/src/routes/_admin/entities/index.tsx`. `EntityListPage` renders `PaginatedTable` with columns: unitId (8-char prefix), primary title, kind, verified, slug, createdAt, actions (→ edit).
- [x] 9.2 Filters wired: `verified` (All / Verified / Unverified select), `kind` text input, and `q` free-text search across translation titles. All three feed the same `useEntityList({ … })`. (Backed by `GET /entity?q=` Postgres ilike for now — flipping to Meili is a server-side route change with no client signature impact.)
- [x] 9.3 Route `/admin/entities/$unitId` added at `package/admin/src/routes/_admin/entities/$unitId.tsx`. `EntityEditPage` exposes: `verified` Checkbox (substitutes for absent Switch in shadcn), `slug` Input (disabled when `verified=false` with explanatory help text), and inline translation editor (add / remove / edit rows). All three submit through `useUpdateEntity` in a single payload.
- [x] 9.4 Client-side slug validation uses `validateSlug` from `@rezics/contract` with `scope: "entity"`. Inline error message and the submit button disables when slug is non-empty AND (invalid OR `verified=false`).
- [x] 9.5 Both `/admin/entities` routes are children of `/_admin/`, whose `beforeLoad` already enforces admin role and redirects non-admins to `/login` (mirrors every other admin route). Verified: the new entries are not protected separately; they inherit the same gate.

## 10. Documentation & plan hygiene

- [x] 10.1 Update `openspec/plans/wiki-content-ownership-plan.md` with a "Status update 2026-05-16" header note: deferred until paired with history-infrastructure; ships with its first enforced UI surface.

## 11. End-to-end verification

- [x] 11.1 `bun run check:convention` passes across the repo (0 violations).
- [x] 11.2 `bun run knip` — the only delta vs. baseline introduced by this change is the (pre-existing) `attributionApi|default` dual-export hint, which my refactor preserved verbatim. The new contract module (`package/contract/src/entity.ts`) and Meili schema (`package/contract/src/meili/entity.ts`) are reachable via the main barrel and not flagged.
- [x] 11.3 `bun test src/entity src/attribution src/zone` — 33/33 pass. Repo-wide `bun test` reports 219 pass / 45 unique failures, identical set to pre-change baseline (45 unique failures pre-exist in book / chapter / realm-tag / auth-session / token-boundary suites — none touched by this change).
- [ ] 11.4 Manual walkthrough: seed dev DB, log in as a regular user, create a personal entity via `/me/entities/new`, verify it renders at `/entity/$unitId`, attempt to set slug via API (should be rejected), log in as admin, navigate to `/admin/entities/$unitId`, toggle `verified`, set slug, verify `/e/$slug` resolves. — Deferred: requires running dev DB + browser; admin/me routes ship in the next session's UI scope.
- [ ] 11.5 Manual walkthrough: open a book creation flow, embed EntityPicker (temporary scaffold if no consumer ships in this change), search → no results → inline create → verify entity appears in `/me/entities` of the creator. — Deferred: EntityPicker ships in the next session's UI scope.
