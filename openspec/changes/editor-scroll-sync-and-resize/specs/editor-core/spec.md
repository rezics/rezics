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
