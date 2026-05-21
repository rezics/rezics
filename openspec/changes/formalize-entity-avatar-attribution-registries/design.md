## Context

Entity is already a Unit-backed extension used for credited parties and subject identities. CreditAttribution and SubjectAttribution both store `role` as a string and Entity stores `kind` as a string. This is good for Prisma/PostgreSQL migration cost, but public UI and API writes currently allow these strings to behave like open product vocabulary.

The product direction is stricter: app users should choose finite role/kind keys defined in `@rezics/contract`, labels should render through i18n, and expanding the vocabulary should be a code change. The project is still in development, so this change can be a clear cutover with no compatibility aliases for stale keys.

Entity search also needs a stronger foundation. EntityPicker should search the global `entities` index in catalog/public flows, while personal flows may bias current-user entities. The index should support identity search and role/kind facets, but it should not store high-cardinality lists of related Unit ids.

## Goals / Non-Goals

**Goals:**

- Store `Entity.avatar` as a first-class language-neutral field on the Entity extension.
- Make public API writes for entity kind, credit role, and subject role validate against contract registries.
- Keep database storage string-backed to avoid migrations for every vocabulary expansion.
- Provide registry metadata for i18n labels, Unit-type applicability, role prominence, and EntityPicker kind hints.
- Define a dedicated `entities` Meilisearch index with identity fields and reverse role facets.
- Distinguish EntityPicker catalog/public context from personal context.
- Promote book author editing in UI while keeping authorship as `CreditAttribution(role = "author")`.

**Non-Goals:**

- Do not introduce `Book.author`, `Entity.name`, or `Entity.bio` fields.
- Do not convert role/kind columns to Prisma enums.
- Do not support arbitrary role/kind entry in ordinary app UI.
- Do not store `creditedUnitIds` or `subjectUnitIds` arrays in entity search documents.
- Do not solve entity merge/deduplication workflows in this change.
- Do not add a new external search or UI dependency.

## Decisions

### Decision: Contract registries define public vocabulary

`@rezics/contract` will export registries for:

```txt
entityKindRegistry
creditAttributionRoleRegistry
subjectAttributionRoleRegistry
```

Each registry key is the stored slug/key. Registry entries carry product metadata:

```ts
{
  key: "author",
  i18nKey: "attribution.credit.role.author",
  entityKindHints: ["person", "organization"],
  appliesToUnitTypes: ["BOOK"],
  prominence: "metadata"
}
```

The registry is the source for:

- TypeBox/Elysia write schemas.
- Frontend select/combobox options.
- i18n label lookup.
- EntityPicker kind hints.
- Search facet interpretation.

Alternatives considered:

- Keep free-form UI inputs: rejected because it creates inconsistent slugs and untranslatable role labels.
- Use Prisma enums: rejected because registry expansion would require DB migrations despite the data being product vocabulary.
- Store display labels in DB: rejected because role/kind labels are localized UI copy, not canonical data.

### Decision: Database remains string-backed, API writes become strict

Prisma fields stay as strings:

```txt
Entity.kind String?
CreditAttribution.role String
SubjectAttribution.role String
```

Public app-facing schemas narrow input:

```txt
CreateEntityInput.kind -> entityKindKeySchema
UpdateEntityInput.kind -> entityKindKeySchema
LinkCreditAttributionInput.role -> creditAttributionRoleKeySchema
LinkSubjectAttributionInput.role -> subjectAttributionRoleKeySchema
```

Because no old data compatibility is required, read DTOs may also use the narrowed key schemas. If implementation discovers internal seed/import paths that need raw keys, those paths should be explicit admin/internal service methods, not ordinary app endpoints.

### Decision: Entity avatar belongs on Entity, not Unit.extra or UnitTranslation.extra

`avatar` is a language-neutral identity asset similar to `User.avatar`. It belongs on the `Entity` extension:

```txt
Entity.avatar String?
```

It should be projected into `EntityDTO`, brief attribution entity DTOs, Entity search documents, EntityPicker rows, entity cards, and entity detail hero.

Alternatives considered:

- `Unit.extra.avatar`: rejected because avatar is a first-class identity field, participates in search/result display, and needs field-level authority/history semantics.
- `UnitTranslation.extra.avatar`: rejected because avatar is not language-correlated. Book cover remains under `UnitTranslation.extra.coverUrl` because covers can vary by release/language.

### Decision: Entity search document stores facets, not graph membership

The `entities` index will store identity fields and small reverse facets:

```txt
id
unitId
kind
verified
slug
ownerUnitId
avatar
titles
summaries
translations
creditRoles
creditUnitTypes
subjectRoles
subjectUnitTypes
creditCount
subjectCount
createdAt
updatedAt
```

It will not store:

```txt
creditedUnitIds
subjectUnitIds
```

Rationale:

- Related Unit id arrays can grow without bound.
- Private/draft relationships should not leak through a public entity search document.
- Entity detail work lists should query attribution/content APIs, not read a graph snapshot from Meilisearch.
- Facets such as `creditRoles = "author"` and `subjectRoles = "primary_character"` are small and useful for picker filters.

### Decision: Sync fanout is bounded and role facets are partial-updated

Entity identity changes update the entity document directly. Attribution changes update two independent projections:

```txt
CreditAttribution change
  -> patch target content.creditNames
  -> patch entity creditRoles / creditUnitTypes / creditCount

SubjectAttribution change
  -> patch target content.subject*
  -> patch entity subjectRoles / subjectUnitTypes / subjectCount
```

When an Entity title changes, existing content documents whose `creditNames` or `subjectNames` denormalize that title may need broader resync. This should be handled through an async/debounced resync helper rather than doing large synchronous fanout inside the entity update request.

### Decision: EntityPicker is context-aware

EntityPicker will distinguish catalog/public and personal usage.

```txt
catalog/public context
  search: global entities index
  inline create: creationMode = "wiki"
  ranking: exact / verified / kindHint / role relevance
  current-user bias: no

personal context
  search: global entities index plus current-user bias
  inline create: creationMode = "personal"
  ranking: owned matches first, then global matches
```

Role selection should happen before opening or committing EntityPicker. The selected role provides:

- The stored role key.
- The UI label.
- Entity kind hints.
- Whether the role is promoted to Metadata.

For books, `author` is a credit role with metadata prominence. It remains `CreditAttribution(role = "author")`.

### Decision: Federated search gets an entities category

The global search surface should be able to return entities from the `entities` index. Scoped search should not infer entity graph membership from the entity document; if a future scoped entity search is needed, it should be backed by explicit attribution/content queries.

Initial behavior:

- Global scope permits `entities`.
- User scope may permit entities filtered by `ownerUnitId` if the product wants a user's own entities in search.
- Book and realm scopes exclude entities unless a later change defines scoped entity semantics.

## Risks / Trade-offs

- [Risk] Registry expansion requires a code change. -> Mitigation: this is intentional; role/kind vocabulary is product semantics and must carry i18n and UI metadata.
- [Risk] DB strings can still contain invalid values through direct SQL or internal scripts. -> Mitigation: development-stage data can be reset/migrated; seed/import paths should use contract helpers.
- [Risk] Entity title changes can require large content search fanout. -> Mitigation: update entity index immediately and process dependent content denormalization through debounced/background resync.
- [Risk] Public catalog EntityPicker may still create duplicate entities. -> Mitigation: global search, exact-match ranking, verified prominence, and no current-user bias reduce duplication pressure.
- [Risk] Federated search category expansion touches contract/server/app tests. -> Mitigation: keep category behavior narrow: global entities search only, no scoped graph inference.

## Migration Plan

1. Add registry contracts and replace public write schemas with registry key schemas.
2. Add `Entity.avatar` to Prisma and regenerate server Prisma client.
3. Update entity, credit attribution, and subject attribution DTOs/mappers.
4. Update `package/search` entity document schema/builders/settings and add partial sync helpers for reverse role facets.
5. Update server entity/attribution APIs to validate registry keys and trigger entity/content search patches.
6. Update EntityPicker, entity self-claim/edit/detail, and attribution editor UI.
7. Add i18n keys for all registry entries in app/admin locales.
8. Add federated entities category and frontend result rendering.
9. Reset or migrate development rows to registered keys.

Rollback strategy: because this is development-stage and no compatibility is required, rollback can remove the new field/registry usage and reset development data. No production-safe downgrade path is required.

## Open Questions

- Should user-scoped federated search include personal entities by default, or should personal entity discovery remain only in `/user/me/entities` and EntityPicker personal context?
- Should admin/import have an explicit raw-string escape hatch, or should every import path also be required to update the registry before ingestion?
