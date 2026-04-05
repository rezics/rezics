## ADDED Requirements

### Requirement: EditorPanel component

The `@rezics/ui` package SHALL provide an `EditorPanel` component that renders a horizontal bar with left-aligned and right-aligned action slots.

#### Scenario: Left and right slots
- **WHEN** `<EditorPanel left={<Button />} right={<Button />} />` is rendered
- **THEN** the left content SHALL be aligned to the start and the right content SHALL be aligned to the end
- **AND** they SHALL be separated by flex spacer

#### Scenario: Right-only layout
- **WHEN** `<EditorPanel right={<Button />} />` is rendered with no left prop
- **THEN** only the right-aligned content SHALL render

#### Scenario: Left-only layout
- **WHEN** `<EditorPanel left={<Button />} />` is rendered with no right prop
- **THEN** only the left-aligned content SHALL render

### Requirement: RezicsMarkdownEditor composed wrapper

The `@rezics/ui` package SHALL provide a `RezicsMarkdownEditor` component that composes `MarkdownEditor` from `@rezics/editor` with an `EditorPanel` below it, including an image upload button and submit/cancel actions.

#### Scenario: Default rendering
- **WHEN** `<RezicsMarkdownEditor value={v} onChange={fn} onSubmit={fn} />` is rendered
- **THEN** a MarkdownEditor SHALL render above an EditorPanel
- **AND** the panel left side SHALL contain an image button with an icon
- **AND** the panel right side SHALL contain a Submit button

#### Scenario: Cancel button
- **WHEN** an `onCancel` prop is provided
- **THEN** a Cancel button SHALL appear to the left of the Submit button in the right slot

#### Scenario: Image button opens modal
- **WHEN** the user clicks the image button in the panel
- **THEN** the ImageModal SHALL open

#### Scenario: Image inserted from modal
- **WHEN** a provider in the ImageModal produces a URL
- **THEN** `insertImageUrl` SHALL be called on the MarkdownEditor's view with that URL
- **AND** the modal SHALL close

#### Scenario: Submit label customization
- **WHEN** `submitLabel="Reply"` is provided
- **THEN** the submit button text SHALL be "Reply" instead of the default

#### Scenario: Passthrough props
- **WHEN** `mention`, `emoji`, `theme`, `className`, `keybindings`, `plugins`, `preview`, `resize`, or `toolbar` props are provided
- **THEN** they SHALL be forwarded to the underlying MarkdownEditor

### Requirement: RezicsJsonEditor composed wrapper

The `@rezics/ui` package SHALL provide a `RezicsJsonEditor` component that composes `JsonEditor` from `@rezics/editor` with an `EditorPanel` below it, including format and submit actions on the right.

#### Scenario: Default rendering
- **WHEN** `<RezicsJsonEditor value={v} onChange={fn} onSubmit={fn} />` is rendered
- **THEN** a JsonEditor SHALL render above an EditorPanel
- **AND** the panel right side SHALL contain a Format JSON button and a Submit button
- **AND** the panel left side SHALL be empty

#### Scenario: Format button
- **WHEN** the user clicks the Format JSON button
- **THEN** the JSON content SHALL be pretty-printed with 2-space indentation

#### Scenario: Cancel button
- **WHEN** an `onCancel` prop is provided
- **THEN** a Cancel button SHALL appear to the left of the Submit button

#### Scenario: Passthrough props
- **WHEN** `theme`, `className`, `keybindings`, `plugins`, `lint`, or `resize` props are provided
- **THEN** they SHALL be forwarded to the underlying JsonEditor

### Requirement: EditorView ref access

The composed wrappers SHALL access the underlying `EditorView` via a ref to invoke commands (insertImageUrl, format JSON).

#### Scenario: MarkdownEditor view ref
- **WHEN** `RezicsMarkdownEditor` mounts
- **THEN** it SHALL obtain a ref to the underlying `EditorView` for calling `insertImageUrl`

#### Scenario: JsonEditor view ref
- **WHEN** `RezicsJsonEditor` mounts
- **THEN** it SHALL obtain a ref to the underlying `EditorView` for calling the format command
