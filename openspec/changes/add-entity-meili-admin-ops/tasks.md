## 1. Backend admin endpoints

- [x] 1.1 Add `POST /meili/entities/sync` as a root-only full entity reindex operation.
- [x] 1.2 Add `DELETE /meili/entities/deleteAll` as a root-only delete-all-documents operation.
- [x] 1.3 Add a `MeiliService.deleteAllEntities()` wrapper.

## 2. API client

- [x] 2.1 Add entity init/sync/delete admin HTTP wrappers.
- [x] 2.2 Add entity init/sync/delete React Query mutation hooks.

## 3. Admin UI

- [x] 3.1 Add entities init, sync, and delete-all controls to `/meili`.
- [x] 3.2 Update destructive reset copy to include the entities index.

## 4. Validation

- [x] 4.1 Run relevant typecheck/tests.
