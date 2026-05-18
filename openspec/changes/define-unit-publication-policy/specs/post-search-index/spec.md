## ADDED Requirements

### Requirement: Post search indexes only public published posts
The post search index SHALL contain only posts whose backing Unit is `PUBLISHED` and `PUBLIC`.

#### Scenario: Private post is synced
- **WHEN** post sync processes a post whose backing Unit visibility is `PRIVATE`
- **THEN** the sync SHALL remove that post document from the post index

#### Scenario: Deleted post is synced
- **WHEN** post sync processes a post whose backing Unit status is `DELETED`
- **THEN** the sync SHALL remove that post document from the post index

### Requirement: Public post search excludes non-public posts
Public post search SHALL NOT return posts whose backing Unit is not public eligible.

#### Scenario: Public search runs after visibility change
- **WHEN** a post changes from `PUBLIC` to `PRIVATE`
- **THEN** public post search SHALL stop returning the post after sync completes
