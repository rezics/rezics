## ADDED Requirements

### Requirement: Node URL is the sole canonical reading surface

The reading view at `/book/:bookId/node/:nodeId` SHALL be the only route for
reading a book's content. The system SHALL NOT expose a content-Unit-keyed reading
route such as `/book/:bookId/read/:chapterId`. Every surface that links a reader to
book content — the table of contents (all TOC tree components), continuation
actions, and the post-materialization navigation target — SHALL address the target
by `ContentStructureNode.id` via `/book/:bookId/node/:nodeId`.

Because a `nodeId` exists for every node — materialized or empty — TOC links SHALL
NOT use a sentinel route id or encode a `BookContentStructurePath` into search
params. A node whose `contentUnitId` is null SHALL link to its node URL directly and
render the empty-node view there.

The node reading view SHALL serve, without regression, the behaviors previously
served by the removed read route: rendering chapter markdown for a materialized
node, the chapter edit affordance, and the empty-node actions (create/edit chapter
content, start a review, start a discussion, and save reading position). Editing,
review, and discussion actions launched from the reading view SHALL continue to
operate on content identity (`contentUnitId`) — they SHALL materialize the node's
Chapter Unit on demand and navigate to the content-keyed edit/review surfaces.

#### Scenario: Reader opens a materialized node

- **GIVEN** a `ContentStructureNode` `node-x` with a non-null `contentUnitId`
- **WHEN** a reader navigates to `/book/:bookId/node/node-x`
- **THEN** the view SHALL fetch the chapter content via the content Unit and render its markdown
- **AND** an edit affordance SHALL be available to users who can edit the chapter

#### Scenario: Reader opens an empty node

- **GIVEN** a `ContentStructureNode` `node-y` with `contentUnitId = NULL`
- **WHEN** a reader navigates to `/book/:bookId/node/node-y`
- **THEN** the view SHALL render the empty-node placeholder with create/edit, review, discuss, and save-position actions
- **AND** opening the view SHALL NOT materialize a Chapter Unit

#### Scenario: TOC links address nodes directly

- **WHEN** any table-of-contents component renders a node entry (materialized or empty)
- **THEN** the entry SHALL link to `/book/:bookId/node/:nodeId` with the node's id
- **AND** the link SHALL NOT use a sentinel route id or carry a `BookContentStructurePath` in search params

#### Scenario: Materializing from the empty node view navigates to the node URL

- **GIVEN** a reader on the empty-node view for `node-y`
- **WHEN** the reader creates chapter content, materializing `node-y`'s Chapter Unit
- **THEN** the app SHALL remain on / navigate to `/book/:bookId/node/node-y`
- **AND** the app SHALL NOT navigate to a `/book/:bookId/read/:chapterId` route

#### Scenario: Legacy read route is absent

- **WHEN** a request resolves the app route table
- **THEN** no `/book/:bookId/read/:chapterId` route SHALL exist
