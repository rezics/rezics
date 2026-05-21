## 1. Contract Registries

- [x] 1.1 Add entity kind registry and key schema in `package/contract/src/entity.ts` or a dedicated entity registry module.
- [x] 1.2 Add credit attribution role registry and key schema in `package/contract/src/credit-attribution.ts` or a dedicated attribution registry module.
- [x] 1.3 Add subject attribution role registry and key schema in `package/contract/src/subject-attribution.ts` or a dedicated attribution registry module.
- [x] 1.4 Replace public write schemas so entity kind, credit role, and subject role validate against registry key schemas.
- [x] 1.5 Update DTO schemas to expose Entity avatar and narrowed role/kind key types where applicable.
- [x] 1.6 Update contract tests for valid/invalid entity kind, credit role, and subject role keys.

## 2. Data Model And Server Mapping

- [x] 2.1 Add `avatar String?` to the Prisma `Entity` model in `package/server/prisma/schema.prisma`.
- [x] 2.2 Run `bun --filter=@rezics/server run prisma:generate`.
- [x] 2.3 Update Entity create/update service logic to persist avatar and respect wiki/personal creation mode.
- [x] 2.4 Update Entity, CreditAttribution, SubjectAttribution, and Book mappers to include avatar in Entity DTO projections.
- [x] 2.5 Update server route schemas and tests to reject unregistered public role/kind keys.
- [x] 2.6 Update collaborative metadata field keys and history payload capture for `entity.avatar`.

## 3. Entity Search Index

- [x] 3.1 Update `package/contract/src/meili/entity.ts` with avatar, reverse role facets, Unit type facets, and count fields.
- [x] 3.2 Update `package/search/src/client.ts` entity index settings for searchable, filterable, and sortable attributes.
- [x] 3.3 Update `package/search/src/sync.ts` entity document builder to include avatar and reverse attribution facets.
- [x] 3.4 Add partial sync helpers for Entity credit facets and subject facets.
- [x] 3.5 Wire CreditAttribution mutations to patch target content credit fields and affected Entity credit facets.
- [x] 3.6 Wire SubjectAttribution mutations to patch target content subject fields and affected Entity subject facets.
- [x] 3.7 Add tests for entity document shape, role facet filtering, and omission of related Unit id arrays.

## 4. API Clients

- [x] 4.1 Update `@rezics/api/entity` clients and query hooks for Meili-backed entity search.
- [x] 4.2 Update credit and subject attribution API client types to use registry role keys.
- [x] 4.3 Add or update cache invalidation for entity avatar and attribution role facet changes.
- [x] 4.4 Run repo-wide search for old free-form role/kind callsites and migrate them to registry keys.

## 5. App And Admin UI

- [x] 5.1 Update EntityPicker props to include catalog/personal creation context and role-derived kind hints.
- [x] 5.2 Make catalog/public EntityPicker use global entity search with no current-user ownership boost.
- [x] 5.3 Make personal EntityPicker preserve global search while biasing current-user entities.
- [x] 5.4 Add registry-backed role selectors before EntityPicker in credit and subject attribution editors.
- [x] 5.5 Promote book `author` credit editing into the Metadata area while persisting `CreditAttribution(role = "author")`.
- [x] 5.6 Add Entity avatar display/edit support in Entity detail, Entity edit, `/me/entities`, EntityPicker rows, and attribution rows.
- [x] 5.7 Add app/admin i18n keys for all entity kind, credit role, and subject role registry entries.
- [x] 5.8 Update admin entity/unit attribution surfaces to render registry labels and avoid ordinary raw-string role input.

## 6. Federated Search

- [x] 6.1 Add `entities` to the contract SearchCategory schema and federated result sections.
- [x] 6.2 Update server federated search orchestration to query entities for global scope and user-owned entity scope only.
- [x] 6.3 Update frontend search category navigation and result rendering for entities.
- [x] 6.4 Add federated search tests for global entities, book-scope exclusion, and user-scope owner filtering.

## 7. Validation

- [x] 7.1 Run `bun --filter=@rezics/contract test` or the affected contract test subset.
- [x] 7.2 Run `bun --filter=@rezics/server test` or targeted server tests for entity, attribution, and search sync.
- [x] 7.3 Run `bun --filter=@rezics/search test` or targeted search package tests.
- [x] 7.4 Run affected app/admin type checks or tests for EntityPicker, attribution editors, and federated search.
- [x] 7.5 Run `bun run check:convention`.
- [x] 7.6 Run `bun run format:check`.
