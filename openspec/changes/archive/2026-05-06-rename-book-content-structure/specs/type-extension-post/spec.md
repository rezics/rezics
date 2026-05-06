## MODIFIED Requirements

### Requirement: Chapter ordering and grouping live in BookIndex, not Post

A chapter Post SHALL NOT carry ordering, numbering, or parent-chapter fields on the `Post` model. Chapter order and nesting within a book SHALL remain the responsibility of the `BookContentStructure.nodes` JSON field keyed by `bookUnitId`. A content-structure node MAY reference a materialized chapter Post through `chapterUnitId`, but the Post model SHALL remain agnostic of chapter-specific position metadata.

#### Scenario: Post model has no chapter-specific ordering fields

- GIVEN the Post model in the Prisma schema
- WHEN inspecting its fields
- THEN Post SHALL NOT contain `chapterNumber`, `sortOrder`, or `parentChapterUnitId` fields
- AND chapter position SHALL be derivable only by reading `BookContentStructure.nodes` for the target book

#### Scenario: Listing chapters of a book

- GIVEN a book `"book-1"` with three chapter Posts whose `targetUnitId = "book-1"` and `kindKey = "chapter"`
- WHEN a client requests the chapter list for `"book-1"`
- THEN the system SHALL return the three chapter Posts
- AND the order SHALL be determined by `BookContentStructure.nodes`, not by any field on Post

#### Scenario: Content-structure node can exist without a chapter Post

- GIVEN a BookContentStructure node `{ "title": "Chapter One" }` with no `chapterUnitId`
- WHEN the system renders the book content structure
- THEN the node SHALL be valid table-of-contents metadata
- AND no chapter Post SHALL be required until materialization is requested

#### Scenario: Chapter Post does not imply unique content-structure occurrence

- GIVEN a chapter Post with `unitId = "chapter-1"`
- AND a BookContentStructure contains two different paths that both reference `chapterUnitId = "chapter-1"`
- WHEN the system renders or materializes those occurrences
- THEN both occurrences SHALL be valid
- AND occurrence-specific UI state SHALL be keyed by BookContentStructure path rather than by Post fields
