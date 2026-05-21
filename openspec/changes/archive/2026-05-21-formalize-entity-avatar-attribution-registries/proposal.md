## Why

Entity identity, attribution role selection, and EntityPicker search are now central to book and future work creation flows. The current model keeps database strings flexible, but public app surfaces still need finite contract-defined keys so role and kind choices remain coherent, translatable, searchable, and safe to filter.

## What Changes

- Add `Entity.avatar` as a first-class language-neutral identity field, exposed through Entity DTOs, attribution DTOs, entity cards, EntityPicker rows, and the entities search document.
- **BREAKING**: Replace public app-facing free-form entity kind and attribution role inputs with contract registry keys validated by Elysia/TypeBox schemas.
- Keep Prisma storage as `String` fields for `Entity.kind`, `CreditAttribution.role`, and `SubjectAttribution.role`; adding a key should require contract/UI code changes, not a database enum migration.
- Add contract registries for entity kind keys, credit attribution role keys, and subject attribution role keys. Registry entries provide i18n keys, applicable Unit types, role prominence, and EntityPicker kind hints.
- Define a dedicated Meilisearch `entities` index for Entity search, including avatar, identity text, owner/verified/kind filters, and reverse attribution role facets.
- Formalize EntityPicker context:
  - public/catalog flows use global entity search and inline-create wiki-owned entities;
  - personal flows use global entity search with current-user bias and inline-create personal entities.
- Move role selection ahead of EntityPicker in attribution editors so the selected registry role drives labels, kind hints, prominence, and search behavior.
- Treat book authorship as `CreditAttribution(role = "author")`; UI may promote the role to Metadata, but no `Book.author` field is introduced.

## Capabilities

### New Capabilities

- `entity-search-index`: Defines the dedicated Meilisearch entities index, document shape, filterable role facets, sync triggers, and search semantics for EntityPicker/global entity search.

### Modified Capabilities

- `entity-unit-type`: Add `Entity.avatar` and define `Entity.kind` as a contract registry key rather than arbitrary product input.
- `entity-service`: Validate entity kind keys and avatar writes through Elysia schemas; sync avatar and registry-backed fields into the entities index.
- `entity-picker`: Add public/catalog vs personal creation/search context, and make role-selected kind hints part of the picker flow.
- `entity-self-claim`: Keep personal entity creation personal, add avatar support, and use registry-defined entity kind choices.
- `attribution`: Replace public credit role free-form inputs with contract role keys and define role metadata used by UI/search.
- `subject-attribution`: Replace public subject role free-form inputs with contract role keys and define subject role metadata used by UI/search.
- `federated-search`: Add an entities category/global section backed by the entities index, while keeping scoped content graph queries out of entity documents.

## Impact

- Affected packages:
  - `package/contract`: entity kind registry, credit role registry, subject role registry, narrowed write schemas, EntityDTO/avatar updates, entity Meili document contract, federated search category updates.
  - `package/server`: Prisma schema for `Entity.avatar`, entity mapper/service/API validation, attribution service schema validation, Meili entities index sync, entity search endpoint/federated integration.
  - `package/search`: entities index settings, document builder, full/partial sync helpers for entity identity and reverse role facets.
  - `package/api`: entity search client/query hooks, attribution hooks typed to registry keys, cache invalidation for avatar/role changes.
  - `package/app`: EntityPicker, entity cards/detail/edit/self-claim surfaces, book metadata attribution editor, credit/subject attribution editors, i18n role/kind labels.
  - `package/admin`: admin entity and Unit attribution surfaces should consume the same registry labels, with no ordinary raw-string role input.
- No backward compatibility is required; this project is still in development. Existing development data may be migrated or reset to valid registry keys.
- No new runtime dependency is expected.
