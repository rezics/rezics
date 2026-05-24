## MODIFIED Requirements

### Requirement: Post card displays author, body, reactions, reply count, and timestamp

Each post rendered in a thread list or thread view SHALL display the author identity, post content, reaction summary, reply count, and creation timestamp.

The post content SHALL be rendered as Markdown through the shared `PostBodyMarkdown` atom, which reads `Post.content` (a `ContentDoc`) and composes `MarkdownContent` from `@rezics/ui` with `Collapsible` wrapping when a preview surface requires clipping. Plaintext rendering of post content is not permitted. Reading or passing a `Post.body` string is not permitted; `Post.body` does not exist after this change.

Post-card presentation components (item cards, reply-node renderers) SHALL NOT contain edit affordances, authorization checks, or edit dialogs. Edit entry points SHALL live on the detail section surface or on a dedicated edit route.

#### Scenario: Post card renders all fields

- **WHEN** a post is displayed in a thread list or thread view
- **THEN** the card SHALL show the author's display name or identifier
- **AND** the card SHALL show the post content rendered as Markdown via `PostBodyMarkdown`
- **AND** the card SHALL show the creation timestamp
- **AND** the card SHALL show the reply count

#### Scenario: Post with reactions

- **WHEN** a post has reactions from users
- **THEN** the post card SHALL display a summary of reactions sourced from `reactionSummaries`

#### Scenario: Post content containing Markdown

- **WHEN** a post's `content.main.source` contains Markdown (lists, emphasis, links, code)
- **THEN** the card SHALL render the Markdown as formatted content via `PostBodyMarkdown`
- **AND** the card SHALL NOT render the content as plaintext
- **AND** the card SHALL NOT read from a `body` string field
