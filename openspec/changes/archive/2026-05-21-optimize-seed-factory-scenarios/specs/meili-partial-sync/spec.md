## ADDED Requirements

### Requirement: Factory search sync is targeted by Unit and index
The factory Meilisearch synchronization step SHALL use targeted single-unit or partial sync functions selected from manifest sync targets. It SHALL synchronize the current database projection for each listed Unit and target.

#### Scenario: Content target syncs one content document
- **WHEN** a manifest entry includes the `content` sync target
- **THEN** factory targeted sync SHALL synchronize that Unit's content search document from the current database state

#### Scenario: Post target syncs one post document
- **WHEN** a manifest entry includes the `post` sync target
- **THEN** factory targeted sync SHALL synchronize that Unit's post search document from the current database state

### Requirement: Factory sync includes required derived patches
Special scenario manifest entries SHALL include every sync target or partial patch required for the scenario's search-visible derived state.

#### Scenario: Shelf contained units are patched
- **WHEN** a complex shelf scenario creates or changes shelf membership
- **THEN** the manifest-driven sync SHALL update the shelf content document's contained Unit metadata

### Requirement: Full sync remains explicit drift repair
Full Meilisearch sync functions SHALL remain available for explicit drift repair or admin operations, but the factory seed flow SHALL NOT use full sync as the default synchronization strategy.

#### Scenario: Factory does not full-sync by default
- **WHEN** a factory run uses Meili mode `init-and-sync`
- **THEN** it SHALL synchronize the manifest targets
- **AND** it SHALL NOT run full content, post, realm, entity, or user reindex functions unless explicitly requested by a separate drift-repair mode
