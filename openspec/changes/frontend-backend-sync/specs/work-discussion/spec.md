## ADDED Requirements

### Requirement: Discussion tab on work detail pages
Every work detail page (book, game, media) SHALL include a Discussion tab that displays threaded discussion for that work. The tab SHALL load posts where the `targetUnitId` matches the current work's unit identifier.

#### Scenario: User navigates to a book detail page
- **WHEN** a user opens a book detail page
- **THEN** a Discussion tab SHALL be available alongside other detail tabs
- **AND** selecting the Discussion tab SHALL display discussion threads associated with that book

#### Scenario: Work has no discussions yet
- **WHEN** a user views the Discussion tab for a work with no posts
- **THEN** the system SHALL display an empty state indicating no discussions exist
- **AND** the system SHALL present the option to start a new discussion

### Requirement: Thread list displays top-level posts for a target unit
The Discussion tab SHALL display a list of top-level posts (posts with no `parentPostUnitId`) for the given `targetUnitId`. The list SHALL be sorted by `createdAt` descending so the most recent threads appear first.

#### Scenario: Multiple threads exist for a work
- **WHEN** a work has three top-level discussion posts created at different times
- **THEN** the thread list SHALL display all three posts ordered from newest to oldest

#### Scenario: Replies are excluded from the thread list
- **WHEN** a work has top-level posts and reply posts (posts with `parentPostUnitId` set)
- **THEN** only the top-level posts SHALL appear in the thread list
- **AND** reply posts SHALL NOT appear as separate entries in the list

### Requirement: Inline post form to start a new discussion thread
The Discussion tab SHALL provide an inline form for starting a new discussion thread. Submitting the form SHALL create a Post with `kind: POST` and `targetUnitId` set to the current work's unit identifier.

#### Scenario: User submits a new discussion thread
- **WHEN** an authenticated user enters text in the inline post form and submits
- **THEN** a new Post SHALL be created with `kind: POST` and the work's `targetUnitId`
- **AND** the new thread SHALL appear at the top of the thread list

#### Scenario: Unauthenticated user sees the post form
- **WHEN** an unauthenticated user views the Discussion tab
- **THEN** the system SHALL either hide the post form or disable submission with a prompt to sign in

### Requirement: Threaded reply view sorted by sort path
When a user opens a thread, the system SHALL display all replies in threaded mode sorted by `sortPath`. The `sortPath` field uses zero-padded segments to maintain hierarchical ordering so that replies appear nested under their parent posts in correct tree order.

#### Scenario: Thread with nested replies
- **WHEN** a user opens a thread that has direct replies and nested replies to those replies
- **THEN** replies SHALL be displayed in `sortPath` order reflecting the thread hierarchy
- **AND** the nesting depth SHALL be visually indicated using the `depth` field

#### Scenario: Flat display mode
- **WHEN** the display mode is set to flat
- **THEN** all replies in the thread SHALL be displayed in `createdAt` order without nesting indentation

### Requirement: Reply form for composing replies to any post
The system SHALL provide a reply form (drawer, inline expansion, or equivalent) that allows users to compose a reply to any post in a thread. Submitting a reply SHALL create a Post with `parentPostUnitId` set to the target post's unit identifier.

#### Scenario: User replies to a top-level post
- **WHEN** an authenticated user activates the reply action on a top-level post and submits a reply
- **THEN** a new Post SHALL be created with `parentPostUnitId` set to the top-level post
- **AND** the new reply SHALL appear in the thread view at the correct position

#### Scenario: User replies to a nested reply
- **WHEN** an authenticated user activates the reply action on an existing reply and submits
- **THEN** a new Post SHALL be created with `parentPostUnitId` set to that reply's unit identifier
- **AND** the `depth` of the new post SHALL be one greater than its parent

### Requirement: Post card displays author, body, reactions, reply count, and timestamp
Each post in the discussion SHALL be rendered as a card displaying the author identity, post body content, reaction summary, reply count, and creation timestamp.

#### Scenario: Post card renders all fields
- **WHEN** a post is displayed in a thread list or thread view
- **THEN** the card SHALL show the author's display name or identifier
- **AND** the card SHALL show the post body
- **AND** the card SHALL show the creation timestamp
- **AND** the card SHALL show the reply count

#### Scenario: Post with reactions
- **WHEN** a post has reactions from users
- **THEN** the post card SHALL display a summary of reactions

### Requirement: Locked thread indicator prevents new replies
When a thread's `isLocked` field is true, the system SHALL display a visual locked indicator and SHALL prevent users from submitting new replies to any post within that thread.

#### Scenario: User views a locked thread
- **WHEN** a user opens a thread where `isLocked` is true
- **THEN** the system SHALL display a locked indicator on the thread
- **AND** reply forms SHALL be hidden or disabled for all posts in the thread

#### Scenario: User views an unlocked thread
- **WHEN** a user opens a thread where `isLocked` is false
- **THEN** no locked indicator SHALL be displayed
- **AND** authenticated users SHALL be able to reply to posts in the thread

### Requirement: Reply count displayed on thread cards
Each thread card in the thread list SHALL display the `replyCount` value so users can gauge thread activity before opening it.

#### Scenario: Thread with replies
- **WHEN** a top-level post has a `replyCount` of 12
- **THEN** the thread card SHALL display the reply count as 12

#### Scenario: Thread with no replies
- **WHEN** a top-level post has a `replyCount` of 0
- **THEN** the thread card SHALL display zero replies or omit the count indicator

### Requirement: Last reply timestamp shown on thread cards
Each thread card SHALL display the `lastReplyAt` timestamp when present, indicating when the most recent reply was posted.

#### Scenario: Thread with recent reply
- **WHEN** a top-level post has a `lastReplyAt` value
- **THEN** the thread card SHALL display the last reply timestamp

#### Scenario: Thread with no replies has no last reply timestamp
- **WHEN** a top-level post has no `lastReplyAt` value
- **THEN** the thread card SHALL NOT display a last reply timestamp

### Requirement: Legacy comment feature directory removed
The old `comment/` feature directory SHALL be deleted. The server-side `comment/` domain is dead code (CommentIndex does not exist) and SHALL NOT be referenced by the discussion module. PostKind.COMMENT is removed; a reply is a Post with `kind: POST` and `parentPostUnitId` set.

#### Scenario: No comment feature references remain
- **WHEN** the discussion module is in use
- **THEN** no imports or references to the old `comment/` feature directory SHALL exist
- **AND** the discussion module SHALL use Post-based APIs exclusively

### Requirement: Discussion module reuses Post API
The discussion module SHALL consume the existing Post API operations (`postApi.list`, `postApi.create`, `postApi.update`, `postApi.remove`) for all data access. The module SHALL NOT introduce separate API endpoints for discussion functionality.

#### Scenario: Loading threads calls postApi.list
- **WHEN** the Discussion tab loads threads for a work
- **THEN** the module SHALL call `postApi.list` with the appropriate `targetUnitId` filter

#### Scenario: Creating a new thread calls postApi.create
- **WHEN** a user submits a new discussion thread
- **THEN** the module SHALL call `postApi.create` with `kind: POST` and the work's `targetUnitId`

#### Scenario: Deleting a post calls postApi.remove
- **WHEN** a user deletes their own post
- **THEN** the module SHALL call `postApi.remove` with the post's identifier

### Requirement: Discussion works for any unit with a target unit identifier
The discussion module SHALL be generic and operate on any entity identified by a `targetUnitId`. It SHALL NOT be coupled exclusively to books. Any work type (book, game, media, or future entity types) that provides a `targetUnitId` SHALL be able to host discussions using the same module.

#### Scenario: Discussion on a game detail page
- **WHEN** a user views the Discussion tab on a game detail page
- **THEN** the discussion module SHALL load and display threads for that game's `targetUnitId`

#### Scenario: Discussion on a media detail page
- **WHEN** a user views the Discussion tab on a media detail page
- **THEN** the discussion module SHALL load and display threads for that media item's `targetUnitId`
