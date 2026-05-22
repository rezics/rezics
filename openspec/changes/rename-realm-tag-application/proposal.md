## Why

`RealmTagUnit` is a misleading name for the current realm-scoped tag model: it reads like a realm-local tag Unit or a `RealmTag` entity, but the row actually records one realm applying an existing global TAG Unit to one target Unit. The name now obscures the most important invariant of the model and makes API, DTO, and service code harder to reason about.

This project is still in development-stage compatibility, so a clear internal cutover is preferable to preserving confusing aliases.

## What Changes

- **BREAKING** Rename `RealmTagUnit` to `RealmTagApplication` across schema-facing code.
- **BREAKING** Rename `RealmTagVote` to `RealmTagApplicationVote` because the vote target is the application row, not the tag identity.
- **BREAKING** Rename public contract DTOs, input schemas, path params, API client functions, query keys, server services, server mappers, tests, and routes from `realm-tag-units` / `RealmTagUnit` vocabulary to `realm-tag-applications` / `RealmTagApplication`.
- Preserve the underlying business semantics: a realm applies an existing global TAG Unit to any target Unit, independent of `RealmUnit` feed membership.
- Preserve `RealmTagContext` naming and semantics. It remains the pair-level `(realmUnitId, tagUnitId)` explanation surface and is not part of this rename.
- Clean up misleading relation names where they reinforce the old ambiguity, including the global `UnitTag` relation name currently called `"TagUnit"`.
- Do not introduce compatibility aliases, dual routes, or dual DTO exports.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `realm-tag-unit`: Rename the capability vocabulary from `RealmTagUnit` to `RealmTagApplication` while preserving the same application semantics.
- `realm-tag-vote`: Rename the vote vocabulary from `RealmTagVote` to `RealmTagApplicationVote` and clarify that votes target realm tag applications.
- `realm-taxonomy-seed-support`: Update seed support requirements to create consistent `RealmTagApplication`, `RealmTagApplicationVote`, `UnitTag`, and `TagVote` rows.
- `content-index`: Rename the indexed realm-tag application source from `RealmTagUnit` to `RealmTagApplication` while preserving machine filter-key behavior.
- `server-route-cleanup`: Update legacy route-cleanup wording so route names and descriptions use `RealmTagApplication`.

## Impact

- Affected packages:
  - `package/server`: Prisma schema, generated client usage, migrations, realm services, realm APIs, tag admin discovery, mappers, tests, Meili sync callsites.
  - `package/contract`: DTO schemas, route input schemas, response schemas, comments, exported types.
  - `package/api`: realm API client, mutations, query keys, type re-exports, compatibility-free hook names.
  - `package/app`: any feature code importing old realm tag unit types, hooks, or route helpers.
  - `package/search`: content document build/patch logic that reads realm-scoped tag applications.
- APIs:
  - Old `/realm-tag-units` and `/realm-tag-votes` routes are replaced by `/realm-tag-applications` and `/realm-tag-application-votes`.
  - No old routes or old type exports remain after the cutover.
- Database:
  - Requires a Prisma migration that renames the tables and constraints/indexes where practical. Data is preserved.
  - The composite identity remains `(realmUnitId, tagUnitId, unitId)` for applications and `(realmUnitId, tagUnitId, unitId, userId)` for votes.
- Compatibility:
  - This is a development-stage breaking rename. Internal callsites are updated in the same change.
  - `RealmTagContext` remains unchanged and continues to reference `(realmUnitId, tagUnitId)`.
