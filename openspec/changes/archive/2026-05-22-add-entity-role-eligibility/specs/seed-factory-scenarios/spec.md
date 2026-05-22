## MODIFIED Requirements

### Requirement: Factory targeted sync uses manifest entries

When Meili mode is `init-and-sync`, the factory flow SHALL synchronize Meilisearch from the seed manifest rather than running a full reindex by default. The targeted sync step SHALL deduplicate sync work by sync target and Unit ID. Manifest entries representing Entity Units SHALL include an entity search sync target so seeded Entities are synchronized to the `entities` index.

#### Scenario: Duplicate manifest entries sync once per target

- **WHEN** multiple manifest entries reference the same Unit ID and sync target
- **THEN** targeted sync SHALL call that sync target at most once for that Unit ID

#### Scenario: Full reindex is not default factory sync

- **WHEN** a factory run completes with Meili mode `init-and-sync`
- **THEN** it SHALL NOT call full reindex functions as the default synchronization strategy

#### Scenario: Entity manifest entries sync entity documents

- **WHEN** a factory run completes with Meili mode `init-and-sync`
- **AND** the seed manifest contains Entity entries
- **THEN** targeted sync SHALL synchronize those Entity documents to the `entities` index
- **AND** the synchronized documents SHALL include `eligibleCreditRoles` and `eligibleSubjectRoles`
