## Collaborative Metadata Rollout Notes

### Mutation Endpoint Audit

Current server endpoints in history/authority scope:

- Book metadata:
  - `POST /book`
  - `PUT /book/:unitId`
  - `PUT /book/:unitId/content-structure`
  - `DELETE /book/:unitId`
- Entity metadata:
  - `POST /entity`
  - `PATCH /entity/:unitId`
  - `DELETE /entity/:unitId`
- Unit common fields and translations:
  - `POST /unit`
  - `PUT /unit/:unitId`
  - `DELETE /unit/:unitId`
  - `PUT /unit/:unitId/translation/:language`
  - `DELETE /unit/:unitId/translation/:language`
  - `PATCH /unit/:unitId/translations/:language/source`
- Attribution:
  - `POST /credit-attribution`
  - `DELETE /credit-attribution/:unitId/:entityId/:role`
  - `POST /subject-attribution`
  - `DELETE /subject-attribution/:unitId/:entityId/:role`
- Tags:
  - `POST /unit-tags`
  - `PATCH /unit-tags/:unitId/:tagUnitId`
  - `DELETE /unit-tags/:unitId/:tagUnitId`
  - Tag definition CRUD under `/tag` remains tag-owner/admin content management, not catalog metadata on the target Unit.

### First Rollout Batch

Migrate these endpoints first because their changed-field-key mapping is direct and their writes already align with content-history slots:

- `PUT /book/:unitId` for Book extension fields and Unit translations.
- `PATCH /entity/:unitId` for Entity extension fields and Unit translations.
- `POST /credit-attribution` and `DELETE /credit-attribution/:unitId/:entityId/:role`.
- `POST /subject-attribution` and `DELETE /subject-attribution/:unitId/:entityId/:role`.
- `POST /unit-tags`, `PATCH /unit-tags/:unitId/:tagUnitId`, and `DELETE /unit-tags/:unitId/:tagUnitId`.
- `PUT /unit/:unitId/translation/:language` for direct translation editing.

### Deferred Endpoints

- Creation endpoints (`POST /book`, `POST /entity`) are covered by creation-mode tasks and should not be reworked as collaborative updates.
- Delete endpoints remain owner/admin-only in v1 and should skip lock lookup.
- `PUT /book/:unitId/content-structure` uses structure-event history and should be migrated separately from editorial metadata.
- Generic `POST /unit` and `PUT /unit/:unitId` are broad administrative surfaces; migrate only after specific Book/Entity/catalog flows are covered.
- Tag definition CRUD under `/tag` manages TAG Units themselves, not target Unit tag assignments, and remains outside the first collaborative metadata batch.
