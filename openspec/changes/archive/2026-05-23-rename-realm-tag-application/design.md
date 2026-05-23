## Context

The current data model already documents the correct behavior: a realm applies an existing global TAG Unit to a target Unit through a scored, voted, pinnable row. The problem is naming. `RealmTagUnit` reads as if a realm owns or creates a tag Unit, even though the model deliberately forbids realm-local tags.

Current identity:

```txt
RealmTagUnit(realmUnitId, tagUnitId, unitId)
RealmTagVote(realmUnitId, tagUnitId, unitId, userId)
RealmTagContext(realmUnitId, tagUnitId)
```

Target identity:

```txt
RealmTagApplication(realmUnitId, tagUnitId, unitId)
RealmTagApplicationVote(realmUnitId, tagUnitId, unitId, userId)
RealmTagContext(realmUnitId, tagUnitId) // unchanged
```

`RealmTagContext` stays unchanged because it names a different concept: the pair-level interpretation/explanation surface for `(realmUnitId, tagUnitId)`.

## Goals / Non-Goals

**Goals:**

- Rename the realm-scoped tag application model to match its product role.
- Preserve all existing behavior, score semantics, pin semantics, and lifecycle independence from `RealmUnit` and `UnitTag`.
- Update internal API and contract surfaces in one clear cutover.
- Remove misleading relation names that reinforce the old ambiguity.

**Non-Goals:**

- Do not change tag search inclusion semantics in this change.
- Do not introduce Unit aliases.
- Do not change `RealmTagContext`.
- Do not add backward-compatible old route aliases, old DTO aliases, or dual-read schema code.
- Do not introduce realm-local tag identities.

## Decisions

### Rename `RealmTagUnit` to `RealmTagApplication`

`RealmTagApplication` is the clearest name because the row represents an action/result: a realm applied a global tag to a target Unit. It does not imply that the application itself is a Unit.

Alternatives considered:

- `RealmScopedTag`: rejected because it can still imply a realm-local tag identity.
- `RealmTagging`: rejected because it reads like an event or behavior rather than a persisted scored aggregate.
- `RealmAppliedTag`: acceptable but less explicit about the target Unit application row.

### Rename `RealmTagVote` to `RealmTagApplicationVote`

Votes target the application row, not the global tag identity and not the realm/tag pair. The longer name is worth the clarity because it prevents accidental aggregation by `(realmUnitId, tagUnitId)` only.

### Keep route names aligned with model names

Routes should move from:

```txt
/realm-tag-units
/realm-tag-votes
```

to:

```txt
/realm-tag-applications
/realm-tag-application-votes
```

There is no compatibility route because this is an internal development-stage cutover.

### Keep `RealmTagContext` unchanged

`RealmTagContext` is not an application to a target Unit. It is pair-level interpretation metadata for `(realmUnitId, tagUnitId)`. Renaming it in this change would mix two distinct concepts and increase blast radius without solving the `RealmTagUnit` ambiguity.

### Clean up misleading relation names

The current global `UnitTag.tag` relation uses the relation name `"TagUnit"`, which can be confused with a model/table name. It should become a role-bearing relation name such as `"UnitTagAppliedTag"`.

Realm application relation names already mostly use role language and should be updated mechanically from `RealmTagApplication...` names after the model rename.

## Risks / Trade-offs

- [Risk] Large internal rename creates missed callsites. -> Mitigation: perform repo-wide search for `RealmTagUnit`, `realmTagUnit`, `realm-tag-units`, `RealmTagVote`, `realmTagVote`, and `realm-tag-votes`; run TypeScript and targeted tests.
- [Risk] Prisma table rename may be generated as drop/create. -> Mitigation: review migration SQL and use table/constraint/index renames where practical to preserve data.
- [Risk] Route rename breaks local callers. -> Mitigation: update `@rezics/contract`, `@rezics/api`, server routes, app imports, and tests in the same change.
- [Risk] `RealmTagContext` may look inconsistent beside the new application names. -> Mitigation: document the distinction: context is pair-level, application is triple-level.

## Migration Plan

1. Rename Prisma models and relation fields.
2. Generate and review Prisma migration SQL to preserve existing data.
3. Regenerate Prisma client.
4. Rename contract DTOs, schemas, and exported types.
5. Rename server services, mappers, APIs, tests, and route prefixes.
6. Rename API client functions, mutations, query keys, and app callsites.
7. Rename search package references and Meili patch helpers that read realm tag applications.
8. Run repo-wide searches for old names and remove all internal aliases.
9. Validate OpenSpec and run affected tests/checks.

Rollback is a reverse internal rename plus reverse migration before deployment. Because no compatibility routes are retained, partial deploys are not supported.
