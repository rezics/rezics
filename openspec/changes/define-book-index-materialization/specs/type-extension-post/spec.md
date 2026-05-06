## MODIFIED Requirements

### Requirement: Chapter ordering and grouping live in BookIndex, not Post

A chapter Post SHALL NOT carry ordering, numbering, or parent-chapter fields on the `Post` model. Chapter order and nesting within a book SHALL remain the responsibility of the `BookIndex` JSON index keyed by `bookUnitId`. A BookIndex node MAY reference a materialized chapter Post through `chapterUnitId`, but a BookIndex node MAY also exist without any materialized Post/Unit.

The Post model SHALL remain agnostic of chapter-specific position metadata. Materialized chapter Posts remain the storage surface for chapter body content, replies, annotations, and other Unit-scoped engagement. Unmaterialized BookIndex nodes are table-of-contents metadata only.

#### Scenario: Post model has no chapter-specific ordering fields

- GIVEN the Post model in the Prisma schema
- WHEN inspecting its fields
- THEN Post SHALL NOT contain `chapterNumber`, `sortOrder`, or `parentChapterUnitId` fields
- AND chapter position SHALL be derivable only by reading the `BookIndex` JSON index for the target book

#### Scenario: Listing materialized chapters of a book

- GIVEN a book `"book-1"` with three chapter Posts whose `targetUnitId = "book-1"` and `kindKey = "chapter"`
- AND the BookIndex contains nodes whose `chapterUnitId` values reference those chapter Posts
- WHEN a client requests the materialized chapter list for `"book-1"`
- THEN the system SHALL return the three chapter Posts
- AND the order SHALL be determined by the BookIndex JSON index, not by any field on Post

#### Scenario: BookIndex node can exist without a chapter Post

- GIVEN a BookIndex node `{ "title": "Chapter One" }` with no `chapterUnitId`
- WHEN the system reads the table of contents for the parent book
- THEN the node SHALL be returned as table-of-contents metadata
- AND the system SHALL NOT require a corresponding Post row to exist

#### Scenario: Chapter Post does not imply unique BookIndex occurrence

- GIVEN a materialized chapter Post with Unit id `"chapter-1"`
- AND a BookIndex contains two different paths that both reference `chapterUnitId = "chapter-1"`
- WHEN the system resolves Unit-scoped engagement for either occurrence
- THEN both occurrences SHALL resolve to the same chapter Post
- AND occurrence-specific UI state SHALL be keyed by BookIndex path rather than by Post fields
