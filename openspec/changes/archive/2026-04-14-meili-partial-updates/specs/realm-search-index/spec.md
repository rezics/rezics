## MODIFIED Requirements

### Requirement: Incremental realm sync on mutations

The realm service SHALL trigger an incremental sync when a realm is created or updated. Realm creation SHALL use full document sync. Realm metadata updates, member count changes, and translation updates SHALL use partial updates with only the affected fields. Sync SHALL be fire-and-forget.

#### Scenario: Realm creation triggers full sync

- **WHEN** a new realm is created via `realm.service.create()`
- **THEN** `syncRealmToMeili(unitId)` SHALL be called with a full document rebuild

#### Scenario: Realm metadata update triggers partial sync

- **WHEN** a realm is updated with metadata changes (isPublic, isOfficial, extra)
- **THEN** `patchRealmMetadata(unitId, { isPublic, isOfficial, extra })` SHALL be called with only the changed fields
- **AND** SHALL NOT re-query unit translations

#### Scenario: Member join triggers partial member count sync

- **WHEN** a user joins a realm via `realm.service.joinRealm()`
- **THEN** `patchRealmMemberCount(unitId, newCount)` SHALL be called with only the updated count
- **AND** SHALL NOT rebuild the entire realm document

#### Scenario: Member leave triggers partial member count sync

- **WHEN** a user leaves a realm via `realm.service.removeMember()`
- **THEN** `patchRealmMemberCount(unitId, newCount)` SHALL be called with only the updated count

#### Scenario: Realm translation update triggers partial translation sync

- **WHEN** a realm unit's translation is created or updated via the translation service
- **THEN** `patchRealmTranslations(unitId)` SHALL be called to update only `titles`, `descriptions`, and `translations`
- **AND** SHALL NOT re-query realm metadata (isPublic, isOfficial, memberCount)
