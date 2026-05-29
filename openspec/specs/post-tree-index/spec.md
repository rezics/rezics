# post-tree-index Specification

## Purpose
TBD - created by archiving change redesign-post-index-ltree. Update Purpose after archive.
## Requirements
### Requirement: Post threading tree uses a native ltree path

The `Post` model SHALL store its position in the threading tree in a
Postgres-native `ltree` column `path`, indexed by a GiST index. The `path`
SHALL be the materialized path from the thread root to the post. The legacy
`sortPath` `VARCHAR` column SHALL NOT exist on the model. Adjacency fields
(`parentPostUnitId`, `rootPostUnitId`) and the denormalized `depth` column
SHALL be retained.

#### Scenario: Top-level post has a single-label path

- **WHEN** a top-level post `R` is created (no `parentPostUnitId`)
- **THEN** `R.path` SHALL be a single ltree label
- **AND** `R.rootPostUnitId` SHALL equal `R.unitId`
- **AND** `R.depth` SHALL be `0`

#### Scenario: Reply path extends the parent path

- **GIVEN** a parent post `P` with `path = "a"` and `depth = 0`
- **WHEN** a reply `C` is created with `parentPostUnitId = P.unitId`
- **THEN** `C.path` SHALL equal `P.path` with one additional label appended
- **AND** `nlevel(C.path)` SHALL equal `nlevel(P.path) + 1`
- **AND** `C.depth` SHALL equal `P.depth + 1`

#### Scenario: GiST index backs subtree containment

- **WHEN** the schema is migrated
- **THEN** a GiST index SHALL exist on `Post.path`
- **AND** subtree queries using `path <@ anchor.path` SHALL be index-backed

### Requirement: ltree labels are append-only and globally unique

Each post SHALL receive exactly one ltree label minted from a dedicated
Postgres sequence and rendered in a fixed alphabet valid for ltree tokens
(`[A-Za-z0-9_]`, e.g. base36 of a `BIGSERIAL`). A label SHALL be unique across
all posts and SHALL be stable for the lifetime of the post. Creating a reply
SHALL NOT rewrite the `path` of any ancestor or sibling.

#### Scenario: Concurrent replies to one parent receive distinct paths

- **GIVEN** a parent post `P`
- **WHEN** two replies are created concurrently with `parentPostUnitId = P.unitId`
- **THEN** each reply SHALL receive a distinct label minted from the sequence
- **AND** the two resulting `path` values SHALL be distinct
- **AND** no read-max-then-write step SHALL be required to avoid collision

#### Scenario: Ancestor paths are never rewritten on insert

- **GIVEN** a thread root `R` and an existing reply `C` under it
- **WHEN** a further reply is appended anywhere in the thread
- **THEN** `R.path` and `C.path` SHALL remain unchanged

### Requirement: Whole-thread retrieval uses the rootPostUnitId index

Retrieval of an entire thread SHALL query by `rootPostUnitId` over its btree
index rather than by `path` containment. The `rootPostUnitId` btree index
SHALL be retained for this purpose.

#### Scenario: Loading a full thread

- **WHEN** a client requests all posts of a thread rooted at `R`
- **THEN** the query SHALL filter by `rootPostUnitId = R.unitId`
- **AND** the query SHALL NOT depend on `path <@` for this whole-thread case

### Requirement: Partial-subtree retrieval uses ltree containment

The subtree under an arbitrary non-root anchor post SHALL be retrieved using `path <@ anchor.path` over the GiST index, scoped to the anchor's `rootPostUnitId` (the continue-thread / `subtreeRootPostUnitId` case). The anchor itself MAY be excluded from the result. A `maxDepth` bound SHALL be expressible as a `depth` filter relative to the anchor's depth.

#### Scenario: Continue-thread loads the anchor subtree

- **GIVEN** an anchor post `A` with a non-empty subtree
- **WHEN** a client requests the subtree under `A`
- **THEN** the query SHALL return posts where `path <@ A.path` and
  `rootPostUnitId = A.rootPostUnitId`
- **AND** `A` itself MAY be excluded from the returned set

#### Scenario: Subtree query is depth-bounded

- **GIVEN** an anchor post `A` at depth `d` and a requested `maxDepth = m`
- **WHEN** the subtree under `A` is queried
- **THEN** only posts with `depth <= d + m` SHALL be returned

### Requirement: Path does not encode presentation order

The `path` column SHALL determine tree topology and depth only. It SHALL NOT be
the ordering key for presentation. The base presentation order SHALL be
expressible as a database `ORDER BY` (for example `createdAt`, or a future
indexable score column). The contract SHALL NOT require that presentation
ordering be computed only in application code, and SHALL NOT expose `sortPath`.

#### Scenario: Threaded view orders by a DB-expressible key

- **WHEN** a thread is loaded for display
- **THEN** sibling order SHALL be derived from a database `ORDER BY` key such as
  `createdAt`, grouped by parent into a tree
- **AND** ordering SHALL NOT require `ORDER BY path`

#### Scenario: Contract no longer exposes sortPath

- **WHEN** a `PostDTO` is produced
- **THEN** it SHALL NOT include a `sortPath` field

### Requirement: One-shot backfill reconstructs paths from adjacency

A one-shot migration SHALL reconstruct every `Post.path` from existing
`parentPostUnitId` / `rootPostUnitId` adjacency in creation order, minting
labels parent-before-child. After backfill, every post SHALL satisfy
`nlevel(path) == depth + 1`, paths SHALL be unique, and each post's subtree
membership SHALL be consistent with its `rootPostUnitId`.

#### Scenario: Existing thread is backfilled

- **GIVEN** a pre-migration thread with a root and nested replies ordered by
  `createdAt`
- **WHEN** the backfill runs
- **THEN** the root SHALL receive a single-label path
- **AND** each reply SHALL receive a path equal to its parent's path plus one
  label
- **AND** `nlevel(path)` SHALL equal `depth + 1` for every post in the thread

