## ADDED Requirements

### Requirement: Posts use UnitStatus.DELETED for user deletion
The system SHALL soft-delete user-deleted posts by marking the backing Unit as `DELETED` and removing body content.

#### Scenario: User deletes a post
- **WHEN** an authorized user deletes a post
- **THEN** the server SHALL set the backing Unit status to `DELETED`
- **AND** the server SHALL remove the post body from normal reads

### Requirement: Deleted posts are excluded from ordinary reads
The system SHALL exclude deleted posts from ordinary public post lists and direct public detail reads.

#### Scenario: Deleted post is listed by target
- **WHEN** a public caller lists posts for a target Unit
- **THEN** posts whose backing Unit is `DELETED` SHALL NOT appear

#### Scenario: Deleted post is opened directly
- **WHEN** a public caller requests a deleted post by Unit ID through the ordinary detail endpoint
- **THEN** the endpoint SHALL return a not-found or gone response instead of a normal post DTO

### Requirement: Tree and reference paths may return tombstones
The system SHALL allow post tree and reference paths to return tombstone DTOs for deleted posts when the tombstone is needed to preserve structure.

#### Scenario: Deleted parent has visible replies
- **WHEN** a post tree contains a deleted parent with visible child replies
- **THEN** the tree response MAY include a tombstone for the deleted parent
- **AND** the tombstone SHALL omit body content

### Requirement: Generic posts do not expose visibility controls
The system SHALL NOT expose user-selectable Unit visibility controls for `kind=POST`.

#### Scenario: Composer creates generic post
- **WHEN** a user creates a generic `kind=POST`
- **THEN** the composer and API SHALL NOT require or expose a visibility picker for that post kind

### Requirement: Post visibility support is tree-wide when present
If non-generic post kinds support Unit visibility, the system SHALL apply visibility at the root/thread level and prevent mixed-visibility trees.

#### Scenario: Reply is created under a visible root
- **WHEN** a reply is created under a root post with Unit visibility metadata
- **THEN** the reply SHALL inherit the root visibility
- **AND** the reply SHALL NOT become more public or more private than the root through ordinary user input
