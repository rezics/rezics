## MODIFIED Requirements

### Requirement: Post body is rendered as Markdown on every surface

Every card, reply-node, and detail renderer for a `PostDTO` SHALL render the post's content through a single shared atom `PostBodyMarkdown`. `PostBodyMarkdown` SHALL accept the `Post.content` `ContentDoc` (rather than a `body` string) and SHALL compose `MarkdownContent` from `@rezics/ui` with an optional `Collapsible` wrapper. When the stored content is not a recognizable `ContentDoc` (unknown schema, unsupported version, malformed JSON, or a raw string), `PostBodyMarkdown` SHALL fall back to rendering the value as Markdown rather than throw. No presentation path SHALL render post content as plaintext `Typography` or a clamped text node, and no presentation path SHALL read from a `body` string.

Preview surfaces (item cards in list contexts) SHALL use `Collapsible` with `maxLines={4}` and i18n-keyed expand/collapse labels. Detail surfaces SHALL render the content without the `Collapsible` wrapper.

#### Scenario: A review card renders the content

- **WHEN** a `ReviewCard` in a list or carousel renders a review
- **THEN** the card SHALL render `review.content` via `PostBodyMarkdown` with `Collapsible` `maxLines={4}`
- **AND** SHALL NOT pass a `body` string prop

#### Scenario: A remark detail page renders the content

- **WHEN** a `RemarkDetail` renders the focal remark on `/remark/:remarkId`
- **THEN** the detail SHALL render `remark.content` via `PostBodyMarkdown` without a `Collapsible` wrapper

#### Scenario: An excerpt card in a carousel renders the content

- **WHEN** an `ExcerptCard` in `HorizontalExcerptCarousel` renders an excerpt
- **THEN** the card SHALL render `excerpt.content` via `PostBodyMarkdown` with `Collapsible` `maxLines={4}`

#### Scenario: Unsupported content falls back to markdown

- **WHEN** a card or detail receives a post whose `content` cannot be parsed as a current-version `ContentDoc`
- **THEN** `PostBodyMarkdown` SHALL render the value as Markdown via the fallback sequence defined by `content-doc-schema`
- **AND** SHALL NOT throw

## REMOVED Requirements

### Requirement: PostBodyMarkdown reads post.body string

**Reason**: The `Post.body` string column and DTO field are removed by this change. `PostBodyMarkdown` now reads `Post.content` `ContentDoc`.

**Migration**: All presentation components that previously passed `post.body` to `PostBodyMarkdown` SHALL pass `post.content` instead, and the `PostBodyMarkdown` prop SHALL be `content: ContentDoc | unknown` (the `unknown` half is handled by the renderer fallback). Repo-wide grep for `PostBodyMarkdown body=` SHALL return no matches after this change.
