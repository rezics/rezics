## ADDED Requirements

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

#### Scenario: Controlled value updates
- **WHEN** the `value` prop changes externally
- **THEN** the editor content SHALL update to reflect the new value without losing cursor position

#### Scenario: onChange callback
- **WHEN** the user edits text in the editor
- **THEN** the `onChange` callback SHALL be invoked with the new document string

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
