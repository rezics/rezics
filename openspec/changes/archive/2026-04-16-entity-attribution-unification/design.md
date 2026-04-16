## Context

The attribution system currently uses four standalone models — `Person`, `Organization`, `PersonCredit`, `OrgCredit` — that lack translation, slug, and language support. The Unit system already provides these features for all content types. Person and Organization are structurally identical (both have `id`, `name`, `extra`), and the service code is entirely duplicated between them.

User already proved that a non-content entity can use Unit as its identity backbone (`User.unitId` as PK). Entity follows the same pattern but as a **content node** — a catalog entry created and managed by users, similar to how Books and Realms are created. Entity has no control authority; it is purely an identifier that users associate with their content via Attribution.

### Current state

```
Person  { id, name, extra }           ← standalone, no translations/slug
Organization { id, name, extra }      ← standalone, no translations/slug
PersonCredit { unitId, personId, roleKey, sortOrder }
OrgCredit    { unitId, organizationId, roleKey, sortOrder }
```

Full CRUD + credit link/unlink duplicated across:
- `package/contract/src/attribution.ts` (separate DTOs × 2)
- `package/server/src/attribution/` (service, mapper, API, types)
- `package/api/src/attribution/` (queries, mutations, keys, types, API client)
- Meilisearch sync in `patchContentCreditsToMeili`

## Goals / Non-Goals

**Goals:**

- Entity becomes a Unit subtype (`ENTITY`) — inherits slug, translations, language support, status, visibility
- Person/Organization distinction captured as optional `kind` string on the `Entity` extension table
- Single `Attribution` table replaces `PersonCredit` + `OrgCredit` as a Unit-to-Unit relationship
- Unified contract, service, and API client — eliminate all person/org duplication
- Add `verified` flag on Entity for future verification features

**Non-Goals:**

- Entity governance or permissions (Entity has no control authority — it is a passive catalog identifier)
- Entity-to-User linking (e.g., linking an author Entity to their platform account)
- Role validation or enum constraints (role remains a free string)
- Frontend Entity detail pages (future scope — contract and backend only in this change)
- Verification workflow implementation (only the schema marker)

## Decisions

### 1. Single UnitType `ENTITY` with `kind` sub-discriminator

**Decision**: One `UnitType.ENTITY` rather than separate `PERSON` / `ORGANIZATION` types.

**Rationale**: Person and Organization have no structural difference — both are named catalog entries with translations. The distinction is metadata, not type. A single type simplifies the Unit type system and extension table pattern. The `kind` field (free string, optional) captures sub-classification without schema changes for new kinds (circle, studio, label, etc.).

**Alternative considered**: Separate `PERSON` and `ORGANIZATION` UnitTypes. Rejected because it would require two extension tables with identical schemas, duplicating the exact problem we're solving.

### 2. Entity extension table: minimal fields

**Decision**: `Entity { unitId, kind?, verified }` — only fields that don't belong on Unit or UnitTranslation.

```prisma
model Entity {
  unitId   String  @id @db.Uuid
  kind     String? @db.VarChar(32)
  verified Boolean @default(false)

  unit Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)
}
```

**Rationale**: Name → `UnitTranslation.title`. Bio → `UnitTranslation.summary`/`description`. Slug → `Unit.slug`. Language support → `UnitTranslation` + `UnitSupportLanguage`. The extension table only holds what's unique to Entity: the kind discriminator and verification status. Additional structured fields (birth date, founded date, country) can be added later or stored in `Unit.extra`.

### 3. Unified Attribution table (Unit-to-Unit)

**Decision**: Single `Attribution` table replacing both `PersonCredit` and `OrgCredit`.

```prisma
model Attribution {
  unitId    String @db.Uuid
  entityId  String @db.Uuid
  role      String @db.VarChar(64)
  sortOrder Int    @default(0)

  unit   Unit @relation("AttributedUnit", fields: [unitId], references: [id], onDelete: Cascade)
  entity Unit @relation("AttributionEntity", fields: [entityId], references: [id], onDelete: Cascade)

  @@id([unitId, entityId, role])
  @@index([entityId, role])
  @@index([unitId, role, sortOrder])
}
```

**Rationale**: Both FK columns now point to Unit, since Entity is a Unit subtype. This eliminates the need for separate join tables. The composite PK `(unitId, entityId, role)` preserves the same uniqueness constraint. `role` replaces `roleKey` (renamed for clarity) and remains a free string defined at the contract level.

**Alternative considered**: Keep `roleKey` naming. Rejected — `role` is shorter and unambiguous in this context.

### 4. Entity CRUD follows Unit creation pattern

**Decision**: Creating an Entity means creating a Unit (type=ENTITY) + Entity extension row in a transaction, similar to how Book creation works (Unit + Book row).

```
createEntity({ kind?, translations, slug? })
  → transaction:
      1. Create Unit (type=ENTITY, slug)
      2. Create Entity (unitId, kind, verified=false)
      3. Create UnitTranslation rows
```

**Rationale**: Follows the established pattern. Entity service composes Unit operations rather than bypassing them.

### 5. Contract defines valid roles per content type

**Decision**: Role validation lives in the contract layer as TypeBox string unions, not in the database schema.

```typescript
// In @rezics/contract
export const bookRoles = ['author', 'co-author', 'translator', 'illustrator', 'editor', 'publisher', ...] as const;
export const gameRoles = ['developer', 'publisher', 'composer', 'designer', ...] as const;
```

**Rationale**: New roles can be added without migrations. Frontend can use these for dropdowns and validation. Backend validates against them at the API boundary. The database stores any string — the contract is the source of truth for what's valid.

### 6. Unit model relation naming

**Decision**: Unit gets two Attribution relations with explicit names:

```prisma
// On Unit model:
attributions   Attribution[] @relation("AttributedUnit")    // credits ON this unit (e.g., book's authors)
attributedAs   Attribution[] @relation("AttributionEntity")  // credits this entity HAS (e.g., author's books)
```

## Risks / Trade-offs

**[Data migration complexity]** → Existing Person/Organization records must be converted to Unit + Entity rows, and PersonCredit/OrgCredit rows to Attribution rows. Mitigation: write a Prisma migration that creates new rows from old data before dropping old tables. This is a one-directional migration — no rollback to old schema.

**[Global slug namespace collision]** → Entity slugs enter the shared Unit.slug pool. Mitigation: slug generation for entities should use a distinguishable pattern (e.g., `liu-cixin` for a person, `kodansha` for an org). The existing slug uniqueness constraint handles collisions. This is the intended behavior per user decision.

**[No DB-level type enforcement on Attribution.entityId]** → The database cannot enforce that `entityId` points to a Unit with `type=ENTITY`. Mitigation: application-level validation in the Attribution service. This is consistent with how other Unit-to-Unit relations work in the codebase.

**[Breaking API changes]** → All attribution endpoints change shape. Mitigation: frontend and backend deploy together (monorepo). No external API consumers. The change is atomic within the monorepo.
