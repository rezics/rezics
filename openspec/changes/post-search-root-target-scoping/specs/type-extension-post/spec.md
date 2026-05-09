## ADDED Requirements

### Requirement: Post carries denormalized root target identifiers

The `Post` model SHALL carry two nullable denormalized fields:

- `rootTargetUnitId` (uuid, nullable, FK to `Unit.id`) — the `targetUnitId` of this post's root post.
- `rootTargetUnitType` (varchar(32), nullable) — the `Unit.type` of the unit referenced by `rootTargetUnitId`.

For a top-level post (where `rootPostUnitId` equals the post's own `unitId`), `rootTargetUnitId` SHALL equal that post's own `targetUnitId`. For a reply, `rootTargetUnitId` SHALL equal the root post's `targetUnitId`. When the root post has no target, both fields SHALL be null.

These fields SHALL be a denormalized projection of canonical relationships, not an independent source of truth. They SHALL exist to enable single-equality filtering in the Meilisearch `posts` index for Book/Game/Media-scoped post search across full reply trees.

The Postgres `Post` table SHALL include an index on `(rootTargetUnitId, createdAt)` to support direct database queries scoped by root target.

#### Scenario: Top-level review carries its own target as rootTargetUnitId

- **GIVEN** a top-level REVIEW post `R` is created with `targetUnitId = "book-B"` and no `parentPostUnitId`
- **WHEN** the post is persisted
- **THEN** `R.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `R.rootTargetUnitType` SHALL equal `"BOOK"`
- **AND** `R.rootPostUnitId` SHALL equal `R.unitId`

#### Scenario: Top-level remark carries its own target as rootTargetUnitId

- **GIVEN** a top-level REMARK post `M` is created with `targetUnitId = "game-G"` and no `parentPostUnitId`
- **WHEN** the post is persisted
- **THEN** `M.rootTargetUnitId` SHALL equal `"game-G"`
- **AND** `M.rootTargetUnitType` SHALL equal `"GAME"`

#### Scenario: Top-level post without a target leaves both fields null

- **GIVEN** a top-level POST is created with `targetUnitId = null`
- **WHEN** the post is persisted
- **THEN** `rootTargetUnitId` SHALL be null
- **AND** `rootTargetUnitType` SHALL be null

### Requirement: Replies inherit root target identifiers from their parent

When a reply post is created with a non-null `parentPostUnitId`, the post creation flow SHALL inherit `rootTargetUnitId` and `rootTargetUnitType` from the parent post. The inheritance SHALL be performed as part of the same database read that already fetches the parent for `rootPostUnitId`, `depth`, and `sortPath` derivation, with no additional database roundtrip introduced.

The derivation SHALL NOT branch on `PostKind`. Replies of any `PostKind` (including `REVIEW`, `EXCERPT`, `REMARK`, `POST`, `CHAPTER`) SHALL inherit from their parent identically.

#### Scenario: Direct reply inherits rootTargetUnitId from parent review

- **GIVEN** a REVIEW post `R` with `rootTargetUnitId = "book-B"` and `rootTargetUnitType = "BOOK"`
- **WHEN** a comment `C1` is created with `parentPostUnitId = R.unitId`
- **THEN** `C1.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `C1.rootTargetUnitType` SHALL equal `"BOOK"`

#### Scenario: Nested reply inherits rootTargetUnitId from its parent reply

- **GIVEN** a comment `C1` with `rootTargetUnitId = "book-B"`
- **WHEN** a reply `C2` is created with `parentPostUnitId = C1.unitId`
- **THEN** `C2.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `C2.rootTargetUnitType` SHALL equal `"BOOK"`

#### Scenario: Reply derivation does not add a database roundtrip

- **WHEN** a reply is created via `PostService.create` with a non-null `parentPostUnitId`
- **THEN** the parent fetch SHALL include `rootTargetUnitId` and `rootTargetUnitType` in its select set
- **AND** no separate query SHALL be issued to read the root post or the target unit

### Requirement: Root target identifiers are immutable through Post.update

The `Post.update` API SHALL NOT accept changes to `rootTargetUnitId` or `rootTargetUnitType`. Editing post `body`, `isLocked`, or `extra` SHALL leave both fields unchanged.

The `Post.update` API SHALL NOT accept changes to `targetUnitId`. As a consequence, no human-triggerable code path in the current product can produce write amplification across descendants of a root post.

#### Scenario: Editing post body leaves rootTargetUnitId unchanged

- **GIVEN** a post `P` with `rootTargetUnitId = "book-B"`
- **WHEN** `Post.update(P.unitId, { body: "new text" })` is called
- **THEN** `P.rootTargetUnitId` SHALL still equal `"book-B"`
- **AND** `P.rootTargetUnitType` SHALL still equal `"BOOK"`

#### Scenario: Update API rejects rootTargetUnitId in input

- **WHEN** an `UpdatePostInput` payload includes `rootTargetUnitId` or `rootTargetUnitType`
- **THEN** the field SHALL be ignored or rejected by the input contract
- **AND** the persisted post values SHALL remain unchanged

### Requirement: Root target denormalization is eventually consistent on target deletion

When the `Unit` referenced by a root post's `targetUnitId` is deleted (triggering `onDelete: SetNull` on `Post.targetUnitId`), descendant posts' denormalized `rootTargetUnitId` and `rootTargetUnitType` MAY become stale until the next manual resync. The system SHALL document this as a known eventual-consistency window. Automatic cascade is out of scope; rerunning the backfill repairs descendants.

#### Scenario: Target unit deletion leaves descendants temporarily stale

- **GIVEN** Book `B` with REVIEW `R` (`targetUnitId = B`) and reply `C1` (`rootTargetUnitId = B`)
- **WHEN** Unit `B` is deleted, causing `R.targetUnitId` to become null via `onDelete: SetNull`
- **THEN** `R.rootTargetUnitId` MAY remain `B` until repair
- **AND** `C1.rootTargetUnitId` MAY remain `B` until repair
- **AND** rerunning the backfill SHALL set both to null
