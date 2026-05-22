## 1. Prisma Rename

- [ ] 1.1 Rename Prisma model `RealmTagUnit` to `RealmTagApplication` and `RealmTagVote` to `RealmTagApplicationVote` in `package/server/prisma/schema.prisma`.
- [ ] 1.2 Rename Prisma relation fields and relation names to use application vocabulary while keeping `RealmTagContext` unchanged.
- [ ] 1.3 Rename the misleading global UnitTag relation name `"TagUnit"` to a role-bearing name such as `"UnitTagAppliedTag"`.
- [ ] 1.4 Generate a Prisma migration and review SQL so existing data is preserved through table/constraint/index renames where practical.
- [ ] 1.5 Run `bun --filter=@rezics/server run prisma:generate`.

## 2. Contract Cutover

- [ ] 2.1 Rename realm application DTO schemas, input schemas, path params, response schemas, and exported TypeScript types in `package/contract/src/realm.ts`.
- [ ] 2.2 Rename `RealmTagVote` contract exports to `RealmTagApplicationVote` equivalents.
- [ ] 2.3 Update contract comments to describe application identity as `(realmUnitId, tagUnitId, unitId)`.
- [ ] 2.4 Verify no old `RealmTagUnit` / `RealmTagVote` contract exports remain.

## 3. Server Cutover

- [ ] 3.1 Rename realm service methods in `package/server/src/realm/realm.service.ts` from `createRealmTagUnit`, `setRealmTagUnitPin`, `deleteRealmTagUnit`, `castRealmTagVote`, and list/discovery helpers to application vocabulary.
- [ ] 3.2 Rename server route modules and route prefixes from `/realm-tag-units` and `/realm-tag-votes` to `/realm-tag-applications` and `/realm-tag-application-votes`.
- [ ] 3.3 Rename realm mappers, tests, mocks, and imports under `package/server/src/realm`.
- [ ] 3.4 Update tag admin discovery route text and response keys where it references low-score realm tag rows.
- [ ] 3.5 Update server OpenAPI details and source comments to remove old `RealmTagUnit` vocabulary.

## 4. API And App Cutover

- [ ] 4.1 Rename `package/api/src/realm` API client functions, mutations, query keys, exported types, and comments to application vocabulary.
- [ ] 4.2 Rename any `package/app` imports, hooks, or UI labels that reference `RealmTagUnit` or `RealmTagVote`.
- [ ] 4.3 Verify no compatibility aliases are introduced in `@rezics/api` or `@rezics/contract`.

## 5. Search And Seed References

- [ ] 5.1 Update `package/search` content document build/patch code to read `RealmTagApplication` relations.
- [ ] 5.2 Update content index comments and contract comments that describe realm tag keys.
- [ ] 5.3 Update seed helpers and seed tests to create `RealmTagApplication` and `RealmTagApplicationVote` rows.
- [ ] 5.4 Keep `realmTagKeys` field behavior unchanged unless a separate search contract change renames the field.

## 6. Repo-Wide Cleanup

- [ ] 6.1 Run repo-wide searches for `RealmTagUnit`, `realmTagUnit`, `realm-tag-units`, `RealmTagVote`, `realmTagVote`, and `realm-tag-votes`; remove all internal old-name callsites.
- [ ] 6.2 Run repo-wide searches for old Prisma delegate names after generation and update remaining references.
- [ ] 6.3 Confirm `RealmTagContext` names are still present and unchanged.

## 7. Validation

- [ ] 7.1 Run targeted server tests for realm application creation, voting, pinning, deletion, and low-score discovery.
- [ ] 7.2 Run affected API/package TypeScript checks for `@rezics/contract`, `@rezics/server`, `@rezics/api`, and `@rezics/app`.
- [ ] 7.3 Run `bun run check:convention`.
- [ ] 7.4 Run `openspec validate rename-realm-tag-application --strict`.
