## MODIFIED Requirements

### Requirement: Incremental post sync on mutations

The post service SHALL trigger an incremental sync to Meilisearch when a post is created, updated, or deleted. Post creation and deletion SHALL use full document sync. Post updates (body, isLocked, extra) SHALL use partial updates with only the changed fields. All syncs SHALL be fire-and-forget.

#### Scenario: Post creation triggers full sync

- **WHEN** a new post is created via `post.service.create()`
- **THEN** `syncPostToMeili(unitId)` SHALL be called with a full document rebuild (all fields including denormalized author, target, score data)

#### Scenario: Post update triggers partial sync

- **WHEN** a post is updated via `post.service.update()` with changed fields (e.g., body, isLocked)
- **THEN** `patchPostFields(unitId, { body, isLocked })` SHALL be called with only the changed fields
- **AND** SHALL NOT re-query author, target unit, or score entry data

#### Scenario: Post deletion triggers full sync (removal)

- **WHEN** a post is soft-deleted via `post.service.delete()`
- **THEN** `syncPostToMeili(unitId)` SHALL be called, which SHALL remove the document from the index
