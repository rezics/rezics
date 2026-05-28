# editor-core Specification

## Purpose

Defines the core CodeMirror 6 editor runtime that hosts all editing
capabilities in the app: the `EditorPlugin` interface, the
`createEditor` factory, the `<Editor />` React component, the
`useEditor` hook, and the `EditorContext` for cross-component access.
The core also owns three-layer keybinding resolution, the theme
extension wrapper, and the fixed-height behavior that lets editors
participate in resizable container layouts.

## Requirements

### Requirement: Plugin interface contract
The system SHALL define an `EditorPlugin` interface with the following fields: `name` (string, required), `extensions` (CM6 Extension or Extension array, optional), `keybindings` (KeyBinding array, optional), and `toolbar` (ToolbarItem array, optional). Plugin factories SHALL be functions returning an `EditorPlugin`.

#### Scenario: Plugin provides extensions only
- **WHEN** a plugin is created with `{ name: 'my-plugin', extensions: [myExtension] }`
- **THEN** the core SHALL include `myExtension` in the EditorState configuration

#### Scenario: Plugin provides keybindings and toolbar items
- **WHEN** a plugin provides `keybindings` and `toolbar` arrays
- **THEN** the core SHALL merge keybindings into the keymap and toolbar items into the toolbar renderer

### Requirement: EditorView lifecycle management
The system SHALL provide a `createEditor` function that accepts a parent DOM element, initial document content, an array of `EditorPlugin` objects, optional consumer keybinding overrides, and an optional theme. It SHALL return an `EditorView` instance with all plugin extensions, keybindings, and theme composed into the initial state.

#### Scenario: Editor creation with plugins
- **WHEN** `createEditor` is called with a parent element, document string, and two plugins
- **THEN** an `EditorView` SHALL be created with both plugins' extensions merged into the state
- **THEN** the EditorView SHALL be attached to the provided parent element

#### Scenario: Editor cleanup
- **WHEN** the editor is destroyed
- **THEN** `EditorView.destroy()` SHALL be called and all references released

### Requirement: Three-layer keybinding resolution
The system SHALL resolve keybindings in three priority layers: consumer overrides (highest, `Prec.highest`), plugin defaults (normal, `Prec.default`), and CM6 built-ins (lowest, `Prec.low`). A consumer override for a key combination SHALL take precedence over a plugin default for the same combination.

#### Scenario: Consumer override takes precedence
- **WHEN** a plugin registers `Mod-s` as a default keybinding and the consumer also provides a `Mod-s` override
- **THEN** the consumer's handler SHALL be invoked when `Mod-s` is pressed
- **THEN** the plugin's handler SHALL NOT be invoked

#### Scenario: Plugin default when no consumer override
- **WHEN** a plugin registers `Mod-b` as a default keybinding and no consumer override exists for `Mod-b`
- **THEN** the plugin's handler SHALL be invoked when `Mod-b` is pressed

### Requirement: CM6 theme extension support
The system SHALL provide a `createTheme` helper function that wraps `EditorView.theme()`. Consumers SHALL be able to pass a theme to the editor to control syntax highlighting colors, editor background, cursor color, selection color, gutter styling, and other visual properties.

#### Scenario: Custom dark theme applied
- **WHEN** a consumer provides a dark theme via `createTheme({ variant: 'dark', settings: { background: '#1e1e1e' } })`
- **THEN** the editor SHALL render with the specified background color and dark variant styles

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

### Requirement: useEditor hook
The system SHALL provide a `useEditor` hook that returns a ref callback for the container element and an `EditorView` ref for imperative access. The hook SHALL handle EditorView creation on mount and destruction on unmount.

#### Scenario: Imperative view access
- **WHEN** a consumer uses `useEditor` and accesses the view ref after mount
- **THEN** the ref SHALL contain the active `EditorView` instance
- **THEN** the consumer SHALL be able to call `view.dispatch()` to programmatically modify editor state

### Requirement: EditorContext for cross-component communication
The system SHALL provide an `EditorContext` (React context) that exposes the current `EditorView` instance. This context SHALL be used by the React toolbar variant and any external components that need to read editor state or dispatch commands.

#### Scenario: React toolbar reads editor state
- **WHEN** a React toolbar component consumes `EditorContext`
- **THEN** it SHALL have access to the current `EditorView` to read state and dispatch transactions
