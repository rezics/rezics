## ADDED Requirements

### Requirement: TOC save records structure history

The `PUT /books/:bookUnitId/content-structure` save path SHALL record a `book.contentStructure.batch` history outbox row in the same transaction as canonical `BookContentStructureNode` mutations when at least one node is inserted, updated, moved, deleted, linked, unlinked, or bulk-replaced.

#### Scenario: Mutating TOC save writes history outbox

- **WHEN** a TOC editor save changes one or more `BookContentStructureNode` rows
- **THEN** the save transaction SHALL write one `HistoryOutbox` row with category `structure_event`
- **AND** the history payload SHALL use `eventType = "book.contentStructure.batch"`
- **AND** the canonical TOC mutations and history outbox row SHALL commit or roll back together

#### Scenario: No-op TOC save writes no history

- **WHEN** a TOC editor save is structurally identical to the current BookContentStructure
- **THEN** the save SHALL issue zero node mutations
- **AND** it SHALL NOT write a history outbox row

### Requirement: TOC batch operations are domain-level

The TOC history payload SHALL describe semantic operations instead of raw SQL mutations. Operation entries SHALL use stable names and SHALL include enough before/after data for product display.

#### Scenario: Node title change emits update operation

- **WHEN** a TOC save changes a node title from `"Old"` to `"New"`
- **THEN** the batch event SHALL contain an operation with `op = "node.update"`
- **AND** the operation SHALL identify the node id
- **AND** the operation SHALL include before and after title values

#### Scenario: Node move emits move operation

- **WHEN** a TOC save changes a node's `parentId` or `sortKey`
- **THEN** the batch event SHALL contain an operation with `op = "node.move"`
- **AND** the operation SHALL include the previous and new parent/order placement

#### Scenario: Node delete preserves display context

- **WHEN** a TOC save deletes a node
- **THEN** the batch event SHALL contain an operation with `op = "node.delete"`
- **AND** the operation SHALL include the deleted node's title, chapterUnitId when present, noContent flag, rating, parent placement, and descendant count

### Requirement: TOC history uses one sequence per logical save

A single TOC save SHALL consume one Unit history sequence, regardless of how many node-level operations are included in the batch payload.

#### Scenario: Multi-operation save shares sequence

- **WHEN** a TOC save creates two nodes and moves one existing node
- **THEN** the save SHALL write one history outbox row
- **AND** all three operations SHALL be stored under the same history sequence

### Requirement: TOC history actor and message

The TOC save endpoint SHALL attribute structure history to the authenticated actor and SHALL preserve an optional edit message when supplied by the client or server-side caller.

#### Scenario: User save records actor

- **WHEN** user `"user-1"` saves a TOC edit
- **THEN** the structure history event SHALL store `actorUserId = "user-1"`

#### Scenario: Bot sync records bot actor

- **WHEN** an authenticated bot account performs a TOC sync
- **THEN** the structure history event SHALL store that bot user's id as `actorUserId`
- **AND** the event SHALL NOT use a separate bot actor taxonomy
