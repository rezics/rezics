## MODIFIED Requirements

### Requirement: React Editor component

The system SHALL provide an `<Editor />` React component that accepts `value` (string), `onChange` (callback), `plugins` (EditorPlugin array), `keybindings` (record of key-to-handler), `toolbar` (variant name or `false`), and `theme` (CM6 theme extension). The component SHALL manage EditorView lifecycle through mount, update, and unmount.

When the editor is rendered with a `resize` config, the `ResizableWrapper` SHALL enforce a minimum container height that accounts for the header bar height. The effective minimum height SHALL be `configuredMinHeight + headerHeight`, ensuring the content area below the header is always >= the configured `minHeight`.

The header height SHALL be measured via a ref after mount. If the header resizes (e.g., toolbar wrapping on narrow viewports), the effective minimum SHALL be recalculated.

#### Scenario: Controlled value updates

- **WHEN** the `value` prop changes externally
- **THEN** the editor content SHALL update to reflect the new value without losing cursor position

#### Scenario: onChange callback

- **WHEN** the user edits text in the editor
- **THEN** the `onChange` callback SHALL be invoked with the new document string

#### Scenario: Resize minHeight accounts for header

- **WHEN** the editor is rendered with `resize.minHeight` of 150 and the header is 40px tall
- **THEN** the `ResizableWrapper` SHALL enforce a minimum container height of 190px
- **THEN** the content area below the header SHALL have at least 150px of available height

#### Scenario: Header height recalculated on resize

- **WHEN** the toolbar wraps to a second row due to a narrow viewport
- **THEN** the effective minimum height SHALL increase to reflect the new header height
- **THEN** the content area SHALL still have at least `configuredMinHeight` pixels of height

### Requirement: Fixed-height CodeMirror extension

When the editor is rendered with a `resize` config (fixed-height mode), the CodeMirror `.cm-editor` element SHALL stretch to fill 100% of its container height. The `.cm-scroller` element SHALL handle overflow scrolling so that the entire editor area is interactive.

This extension SHALL NOT be applied when the editor is in free-flowing mode (no `resize` config), where the editor should size to its content.

#### Scenario: Editor fills container in resize mode

- **WHEN** the editor is rendered with a `resize` config and the container has 400px of available content height
- **AND** the document has only 3 lines of text (~60px of content)
- **THEN** the `.cm-editor` element SHALL have a rendered height of 400px
- **THEN** clicking anywhere in the 400px area (including below the last line) SHALL focus the editor

#### Scenario: Clicking empty space places cursor

- **WHEN** the editor is in resize mode with content that does not fill the container
- **AND** the user clicks in the empty space below the last line of content
- **THEN** the editor SHALL receive focus
- **THEN** the cursor SHALL be placed at the end of the document

#### Scenario: Extension not applied in free-flowing mode

- **WHEN** the editor is rendered without a `resize` config
- **THEN** the `.cm-editor` element SHALL size to its content height
- **THEN** no fixed-height styles SHALL be applied

#### Scenario: Dual-column mode both panes fill height

- **WHEN** the editor is in dual-column mode with a `resize` config
- **THEN** both the editor pane and the preview pane SHALL fill the available height
- **THEN** each pane SHALL independently scroll its own content
