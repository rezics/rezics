## ADDED Requirements

### Requirement: Entity seed uses batch insert

The person and organization entity seeders SHALL use a two-phase batch insert pattern instead of sequential `prisma.unit.create` loops. Phase 1 creates all Unit rows via `createMany`. Phase 2 creates Entity extension rows and UnitTranslation rows via separate `createMany` calls.

#### Scenario: Person entities created in batch

- **WHEN** 800 person entities are seeded
- **THEN** the seeder SHALL issue no more than 10 `createMany` calls for Unit rows (batched), not 800 individual `create` calls

#### Scenario: Batch insert produces correct data

- **WHEN** entity seed completes via batch insert
- **THEN** every Entity row SHALL have a corresponding Unit row and at least one UnitTranslation row

### Requirement: Chapter seed uses batch insert for mega-books

When a book has more than 50 chapters, the chapter seeder SHALL use `createMany` for Unit and UnitTranslation rows instead of individual creates. Books with 50 or fewer chapters MAY continue using individual creates.

#### Scenario: Mega-book chapters created efficiently

- **WHEN** a book with 500 chapters is seeded
- **THEN** the chapter seeder SHALL use `createMany` batches rather than 500 individual `create` calls

#### Scenario: Small book chapters unchanged

- **WHEN** a book with 20 chapters is seeded
- **THEN** the chapter seeder MAY use individual creates or batch inserts (either is acceptable)

### Requirement: Post seed uses batch insert for high-engagement works

When a work receives more than 20 posts (of any kind), the post seeder SHALL use `createMany` for Unit rows and Post extension rows. The seeder SHALL fall back to individual creates for works with 20 or fewer posts.

#### Scenario: High-engagement work posts batched

- **WHEN** a work with 80 tree posts is seeded
- **THEN** the post seeder SHALL use `createMany` batches for the Unit and Post rows

### Requirement: Chunked parallelism preserved

All batch operations SHALL continue to use `chunkedParallel` or equivalent chunking to avoid overwhelming the database connection pool. Batch sizes for `createMany` SHALL not exceed 500 rows per call.

#### Scenario: Large batch is chunked

- **WHEN** 1000 entity Units are created via batch
- **THEN** the operation SHALL be split into chunks of at most 500 rows each

### Requirement: Attribution batch insert

Attribution records (linking entities to works) SHALL be collected per-chunk and inserted via `createMany` rather than per-work individual creates, when processing works in batch.

#### Scenario: Attributions batched across works

- **WHEN** a chunk of 10 works is processed
- **THEN** all attribution records for those 10 works SHALL be inserted in a single `createMany` call
