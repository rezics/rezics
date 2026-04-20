## MODIFIED Requirements

### Requirement: Threaded reply view sorted by sort path

When a user opens a thread, the system SHALL display all replies in threaded mode sorted by `sortPath`. The `sortPath` field uses zero-padded segments to maintain hierarchical ordering so that replies appear nested under their parent posts in correct tree order.

Thread loading SHALL be bounded by server-enforced depth: the client SHALL query with `mode: "threaded"` and `maxDepth: 5` (or a documented override). Replies deeper than `maxDepth` SHALL NOT be returned in the initial response. The visual indentation applied on the client SHALL cap at a configurable `VISUAL_MAX_DEPTH` (default 4); replies whose `depth` exceeds this value render with the capped indentation while the real `depth` remains available for logical operations.

When a loaded reply sits at the loaded depth limit and still has further replies (`directReplyCount > 0` on a truncated branch), the reply SHALL expose a "continue thread" affordance. Activating the affordance SHALL anchor a fresh thread view with that reply as the new root (`rootPostUnitId`), issuing a new query for its subtree.

Collapse state for branches SHALL be owned by the thread orchestrator (`PostTreeSection`) rather than the reply component. Replies at `depth >= 2` SHALL be collapsed by default on initial render; the user SHALL be able to expand any branch.

#### Scenario: Thread with nested replies

- **WHEN** a user opens a thread that has direct replies and nested replies to those replies
- **THEN** replies SHALL be displayed in `sortPath` order reflecting the thread hierarchy
- **AND** the nesting depth SHALL be visually indicated using the `depth` field capped at `VISUAL_MAX_DEPTH`

#### Scenario: Flat display mode

- **WHEN** the display mode is set to flat
- **THEN** all replies in the thread SHALL be displayed in `createdAt` order without nesting indentation

#### Scenario: Thread truncated at server maxDepth

- **WHEN** a thread contains replies at `depth > 5`
- **THEN** the initial query SHALL NOT return those replies
- **AND** the deepest loaded reply on that branch SHALL, if it has further replies, render a "continue thread" affordance
- **AND** activating the affordance SHALL load a new thread view rooted on that reply

#### Scenario: Default collapse beyond depth 2

- **WHEN** a thread with replies at depth 0, 1, 2, and 3 first renders
- **THEN** replies at `depth >= 2` SHALL be collapsed by default
- **AND** the user SHALL be able to expand any subtree by activating its collapse control

### Requirement: Post card displays author, body, reactions, reply count, and timestamp

Each post rendered in a thread list or thread view SHALL display the author identity, post body content, reaction summary, reply count, and creation timestamp.

The post body SHALL be rendered as Markdown through the shared `PostBodyMarkdown` atom (`MarkdownContent` from `@rezics/ui` with `Collapsible` wrapping when a preview surface requires clipping). Plaintext rendering of `post.body` is not permitted.

Post-card presentation components (item cards, reply-node renderers) SHALL NOT contain edit affordances, authorization checks, or edit dialogs. Edit entry points SHALL live on the detail section surface or on a dedicated edit route.

#### Scenario: Post card renders all fields

- **WHEN** a post is displayed in a thread list or thread view
- **THEN** the card SHALL show the author's display name or identifier
- **AND** the card SHALL show the post body rendered as Markdown
- **AND** the card SHALL show the creation timestamp
- **AND** the card SHALL show the reply count

#### Scenario: Post with reactions

- **WHEN** a post has reactions from users
- **THEN** the post card SHALL display a summary of reactions sourced from `reactionSummaries`

#### Scenario: Post body containing Markdown

- **WHEN** a post body contains Markdown (lists, emphasis, links, code)
- **THEN** the card SHALL render the Markdown as formatted content via `PostBodyMarkdown`
- **AND** the card SHALL NOT render the body as plaintext

#### Scenario: Post owner views their own post in a thread

- **WHEN** the post's author views their own post inside a thread
- **THEN** the post card itself SHALL NOT contain an edit button or menu
- **AND** an edit affordance MAY be provided by the enclosing section (for example a hover action on the row) that routes the user to a dedicated edit surface

### Requirement: Discussion works for any unit with a target unit identifier

The Post module's target-list and thread sections SHALL be generic and operate on any entity identified by a `targetUnitId`. They SHALL NOT be coupled exclusively to books. Any work type (book, game, media, or future entity types) that provides a `targetUnitId` SHALL be able to host a Discussion tab and threaded replies using the same sections.

#### Scenario: Discussion on a game detail page

- **WHEN** a user views the Discussion tab on a game detail page
- **THEN** the tab SHALL render `<PostListSection targetUnitId={gameUnitId} />`
- **AND** the section SHALL load and display threads for that game's `targetUnitId`

#### Scenario: Discussion on a media detail page

- **WHEN** a user views the Discussion tab on a media detail page
- **THEN** the tab SHALL render `<PostListSection targetUnitId={mediaUnitId} />`
- **AND** the section SHALL load and display threads for that media item's `targetUnitId`

## REMOVED Requirements

### Requirement: Discussion module reuses Post API

**Reason**: This requirement framed a standalone "discussion module" that does not exist after this change. The Discussion tab is a UX surface composed from the `post/` feature's `PostListSection` and `PostTreeSection`, which already consume the Post API directly. The requirement's intent (do not introduce parallel discussion endpoints) is preserved by the architecture itself: the `post/` feature is the only code path that reads or writes posts, and no separate discussion endpoints exist.

**Migration**: Remove references to a "discussion module" in downstream documentation. When describing the Discussion tab's data flow, refer to `post/sections/PostListSection` and `post/sections/PostTreeSection` and the Post API operations (`postApi.list`, `postApi.create`, `postApi.update`, `postApi.remove`) they invoke.
