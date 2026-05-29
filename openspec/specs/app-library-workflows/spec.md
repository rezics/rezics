# app-library-workflows Specification

## Purpose

Defines the end-to-end library collection experience in the public app:
discovering content, adding it to a shelf/library collection, viewing it from
the library, updating status/progress, and removing it. It specifies how reading
progress (status, per-book chapter-completion counts, last-read position) is
surfaced and kept consistent across library, dashboard, profile, and book-detail
surfaces, how work/release browsing stays understandable, and how a
readable-content filter scopes library surfaces to items the platform can serve.

## Requirements

### Requirement: User can complete library collection flow

The app SHALL let a user discover a content item, add it to a shelf/library collection, view it from their library, update status/progress, and remove it.

#### Scenario: User shelves a book

- **WHEN** a signed-in user adds a book release to a shelf from a detail page
- **THEN** the shelf action SHALL persist through typed API mutation
- **AND** the item SHALL appear in the user's library/shelf view

### Requirement: Reading progress is visible and actionable

Reading/progress surfaces SHALL show status, a chapter-completion count derived from `UserContentNodeProgress` rows for the book (`chaptersCompleted/chaptersTotal`, where `chaptersTotal` is the count of non-deleted `ContentStructureNode` rows in the book's TOC), the last-read position (`lastReadNodeId`-resolved chapter title and optional `lastReadAnchor.text` preview), and a continuation action that links to `/book/:bookId/node/:nodeId` when `lastReadNodeId` is present. The `chaptersCompleted/chaptersTotal` pair SHALL be server-aggregated (see `DashboardSummary` and equivalent profile/library DTOs); the app SHALL NOT recompute it client-side from raw `UserContentNodeProgress` rows.

#### Scenario: Progress updates dashboard

- **WHEN** a user updates book-level progress (`PUT /me/units/:unitId/progress`) or toggles per-node completion (`POST /me/units/:unitId/node-completion`)
- **THEN** the dashboard and profile/library views SHALL reflect the updated progress (including the chapter-completion count and last-read chapter title) after cache invalidation routed through the cache-coherence map

### Requirement: Work/release browsing is user-understandable

Release-aware pages SHALL show exact release context and work-wide alternatives without making hidden work Units ordinary public detail pages.

#### Scenario: User browses same-work releases

- **WHEN** a release has same-work alternatives
- **THEN** the detail page SHALL expose a releases area with language and edition filters

### Requirement: Per-node completion marks are visible across library surfaces

Library, dashboard, profile reading tab, and book detail surfaces SHALL display per-book chapter-completion progress sourced from `UserContentNodeProgress`. The displayed counter SHALL be `chaptersCompleted/chaptersTotal`, where `chaptersTotal` is the count of non-deleted `ContentStructureNode` rows in the book TOC whose `contentUnitId` is non-null (i.e. nodes the user can mark as read), and `chaptersCompleted` is the count of the viewer's `UserContentNodeProgress` rows pointing at those nodes. Soft-deleted nodes SHALL be excluded from both numerator and denominator. The counter SHALL be provided by server-aggregated DTOs (`DashboardSummary.continueReading`, shelf list responses, profile reading tab DTO, book detail progress DTO); the client SHALL NOT recompute it by fetching the raw `UserContentNodeProgress` table client-side.

The reading view at `/book/:bookId/node/:nodeId` SHALL be the canonical surface for **toggling** per-node completion (the "Mark as read" affordance specified by `type-extension-book`). Other surfaces (library cards, dashboard, profile) SHALL display the counter but SHALL NOT provide a per-node toggle of their own. A future change MAY introduce a bulk "mark all read" or trash/restore management surface; until then, individual toggling stays at the node URL.

#### Scenario: Dashboard library section shows chapter-completion counter

- **GIVEN** a viewer has marked 3 chapters of a 12-chapter book as completed
- **WHEN** the dashboard library section renders that book card
- **THEN** the card SHALL display "3/12" (or the localized equivalent) as the chapter-completion counter
- **AND** the value SHALL come from the server-aggregated `DashboardSummary.continueReading` (or equivalent) DTO

#### Scenario: Soft-deleted nodes do not change the counter

- **GIVEN** a viewer has 3 completed chapters in a book whose TOC has 12 non-deleted nodes
- **WHEN** an editor soft-deletes one of the **incomplete** chapter nodes (so the visible TOC drops to 11)
- **THEN** the next time the viewer's library/dashboard re-fetches, the counter SHALL read "3/11"
- **AND** the viewer's `UserContentNodeProgress` rows SHALL NOT have been touched by the soft delete

#### Scenario: Reader without TOC sees no counter

- **GIVEN** a book Unit that is chapter-shaped with no TOC nodes
- **WHEN** any library/dashboard/profile surface renders a card for that book
- **THEN** the card SHALL omit the chapter-completion counter rather than render "0/0"

### Requirement: Library surfaces support a readable-content filter

Library and shelf surfaces SHALL support filtering to items the platform can serve for reading. For books, the filter SHALL be `isLicensed === true`; without a license the platform cannot present the full text and users can only review or discuss the item. The dashboard library section SHALL apply this filter by default, while standalone shelf pages SHALL expose it as an opt-in toggle so users can still see their full collection.

#### Scenario: User toggles readable filter on shelf page

- **GIVEN** a shelf with a mix of licensed and unlicensed books
- **WHEN** the user enables the readable filter on the shelf page
- **THEN** only books with `isLicensed === true` SHALL render
- **AND** disabling the filter SHALL restore the full list

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
