# editor-image-insert Specification

## Purpose

Defines the `insertImageUrl(view, url, alt?)` command exported from
`@rezics/editor` (and its `/markdown` subpath) that inserts a markdown
image at the editor cursor or replaces the active selection. The
capability owns the insertion behavior and the export surface; image
upload UI and remote storage are out of scope.

## Requirements

### Requirement: insertImageUrl command

The `@rezics/editor` package SHALL export a function `insertImageUrl(view: EditorView, url: string, alt?: string): void` that inserts a markdown image at the current cursor position.

#### Scenario: Insert image with URL and alt text
- **WHEN** `insertImageUrl(view, "https://example.com/img.png", "photo")` is called
- **THEN** the text `![photo](https://example.com/img.png)` SHALL be inserted at the cursor position
- **AND** the cursor SHALL be placed after the closing parenthesis

#### Scenario: Insert image with URL only
- **WHEN** `insertImageUrl(view, "https://example.com/img.png")` is called with no alt argument
- **THEN** the text `![image](https://example.com/img.png)` SHALL be inserted using "image" as the default alt text

#### Scenario: Insert image with text selected
- **WHEN** the editor has text selected and `insertImageUrl(view, url, alt)` is called
- **THEN** the selected text SHALL be replaced with the image markdown
- **AND** the cursor SHALL be placed after the inserted text

### Requirement: Export path

The `insertImageUrl` function SHALL be exported from `@rezics/editor` at the package root and from `@rezics/editor/markdown`.

#### Scenario: Import from package root
- **WHEN** a consumer writes `import { insertImageUrl } from '@rezics/editor'`
- **THEN** the function SHALL be available

#### Scenario: Import from markdown subpath
- **WHEN** a consumer writes `import { insertImageUrl } from '@rezics/editor/markdown'`
- **THEN** the function SHALL be available
