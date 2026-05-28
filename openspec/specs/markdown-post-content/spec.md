# markdown-post-content Specification

## Purpose

Defines the canonical handling of post and chapter bodies: read
from `Post.content` as a `ContentDoc`, render
`content.main = { type: "markdown", source }` via
`MarkdownContent` / `createRezicsRenderer`, and fall back to
treating the value as Markdown when the schema is unrecognized
rather than throwing. Owns the removal of `Post.body` from DTOs
and storage, and the rule that `InlinePostForm` uses
`RezicsMarkdownEditor` whose output is wrapped into a `ContentDoc`
on submit.

## Requirements

### Requirement: Post body rendered as markdown

Post and chapter content SHALL be read from `Post.content` using the shared `ContentDoc` schema. When `content.main.type = "markdown"`, the renderer SHALL render `content.main.source` via `MarkdownContent` and `createRezicsRenderer`. When the stored value is not a recognizable `ContentDoc` (unknown schema, unsupported version, malformed JSON, or a raw string), the renderer SHALL fall back to rendering the value as Markdown rather than throw. `Post.body` SHALL NOT exist as a canonical DTO or database field after this change.

#### Scenario: Post with markdown formatting

- **WHEN** a post content document has `main = { type: "markdown", source: "# Title" }`
- **THEN** the content is rendered as formatted HTML via the markdown renderer

#### Scenario: Post with plain text content

- **WHEN** a post content document has Markdown source containing plain text only
- **THEN** the content is rendered as a paragraph visually equivalent to plain text display

#### Scenario: Legacy body field is absent

- **WHEN** a post DTO is returned by the API
- **THEN** it SHALL expose `content`
- **AND** it SHALL NOT expose `body`

#### Scenario: Unsupported content falls back to markdown

- **WHEN** a post content value cannot be parsed as a current-version `ContentDoc` (e.g. unknown `schema`, future `version`, or a raw string)
- **THEN** the renderer SHALL render the value as Markdown via the fallback sequence defined by `content-doc-schema`
- **AND** the renderer SHALL NOT throw

### Requirement: Post input uses RezicsMarkdownEditor

The inline post form (`InlinePostForm`) SHALL use `RezicsMarkdownEditor` for content input. On submit, the editor output SHALL be wrapped as a `ContentDoc` with `main = { type: "markdown", source: <editor output> }` and stored in `Post.content`. The submitted payload SHALL NOT include `body`.

#### Scenario: Creating a new post

- **WHEN** the user opens the inline post form to write a comment or remark
- **THEN** a `RezicsMarkdownEditor` is presented for content input

#### Scenario: Editor outputs markdown source

- **WHEN** the user writes formatted content and submits
- **THEN** the markdown source text is wrapped into a `ContentDoc` and stored in `Post.content.main.source`
- **AND** the submitted payload SHALL NOT include `body`
