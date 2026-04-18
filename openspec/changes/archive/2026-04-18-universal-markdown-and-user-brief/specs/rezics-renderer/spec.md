## ADDED Requirements

### Requirement: Universal renderer function name
The markdown rendering function SHALL be named `createRezicsRenderer` and exported from `@rezics/editor/markdown`. The previous name `createNovelRenderer` SHALL be removed with no re-export alias.

#### Scenario: Import and use createRezicsRenderer
- **WHEN** a consumer imports `createRezicsRenderer` from `@rezics/editor/markdown`
- **THEN** it returns a configured `MarkdownIt` instance with the same options as the previous `createNovelRenderer` (linkify, typographer, novelModePlugin, sourceLinePlugin)

#### Scenario: Old name no longer exists
- **WHEN** a consumer attempts to import `createNovelRenderer` from `@rezics/editor/markdown`
- **THEN** the import fails — the old name is fully removed

### Requirement: All call sites use the new name
All existing call sites of `createNovelRenderer` SHALL be updated to use `createRezicsRenderer`. This includes the internal `MarkdownEditor` component, `MarkdownContent` component, chapter rendering, and folio text rendering.

#### Scenario: No references to old name remain
- **WHEN** searching the codebase for `createNovelRenderer`
- **THEN** zero results are found
