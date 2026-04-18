## ADDED Requirements

### Requirement: Post body rendered as markdown
`Post.body` content SHALL be rendered via `MarkdownContent` (using `createRezicsRenderer`) instead of plain `whitespace-pre-wrap` text display.

#### Scenario: Post with markdown formatting
- **WHEN** a post body contains markdown syntax (headings, bold, links, code blocks, lists)
- **THEN** the content is rendered as formatted HTML via the markdown renderer

#### Scenario: Post with plain text content
- **WHEN** a post body contains plain text (no markdown syntax)
- **THEN** the content is rendered as a paragraph — visually identical to the previous plain text display

### Requirement: Post input uses RezicsMarkdownEditor
The inline post form (`InlinePostForm`) SHALL use `RezicsMarkdownEditor` for content input instead of a plain `TextField`.

#### Scenario: Creating a new post
- **WHEN** the user opens the inline post form to write a comment or remark
- **THEN** a `RezicsMarkdownEditor` is presented for content input

#### Scenario: Editor outputs markdown source
- **WHEN** the user writes formatted content and submits
- **THEN** the post body is stored as markdown source text in `Post.body`
