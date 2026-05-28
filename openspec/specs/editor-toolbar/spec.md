# editor-toolbar Specification

## Purpose

Defines the `ToolbarItem` contract that editor plugins contribute and
the two toolbar variants that render those items: the CM6 panel
variant (rendered inside the EditorView DOM via `showPanel`) and the
React variant (rendered outside the editor, communicating through
`EditorContext`). The capability also owns the active-state contract
and the disabled (`toolbar={false}`) configuration.

## Requirements

### Requirement: ToolbarItem definition
The system SHALL define a `ToolbarItem` type with fields: `name` (string), `label` (string), `icon` (optional, string or ReactNode), `action` (Command function receiving EditorView), `isActive` (optional, function receiving EditorState returning boolean), and `group` (optional, string for visual grouping). A separator SHALL be representable as a string literal `"|"`.

#### Scenario: Plugin contributes toolbar items
- **WHEN** a plugin provides `toolbar: [{ name: 'bold', label: 'Bold', action: toggleBold, isActive: isBoldActive }]`
- **THEN** the toolbar renderer SHALL include a "Bold" button that invokes `toggleBold` on click

#### Scenario: Active state indication
- **WHEN** the cursor is inside bold-formatted text and `isActive` returns `true`
- **THEN** the toolbar button SHALL visually indicate the active state

### Requirement: CM6 panel toolbar variant
The system SHALL provide a toolbar variant (`toolbar="panel"`) that renders toolbar items inside the EditorView DOM using CM6's `showPanel` extension. The panel SHALL appear above the editor content area.

#### Scenario: Panel toolbar rendering
- **WHEN** the editor is configured with `toolbar="panel"` and plugins provide toolbar items
- **THEN** the toolbar SHALL render as a CM6 panel above the editor content
- **THEN** clicking a toolbar button SHALL invoke the corresponding action on the EditorView

#### Scenario: Panel toolbar updates on state change
- **WHEN** the editor state changes (e.g., cursor moves into bold text)
- **THEN** the panel toolbar SHALL update button active states to reflect the current state

### Requirement: React toolbar variant
The system SHALL provide a toolbar variant (`toolbar="react"`) that renders toolbar items as a React component outside the EditorView DOM. The React toolbar SHALL communicate with the editor via `EditorContext`, reading state through an `EditorView.updateListener` and dispatching commands via `view.dispatch()`.

#### Scenario: React toolbar rendering
- **WHEN** the editor is configured with `toolbar="react"` and plugins provide toolbar items
- **THEN** the toolbar SHALL render as a React component above the editor
- **THEN** the toolbar SHALL be stylable with standard CSS/className props

#### Scenario: React toolbar dispatches commands
- **WHEN** a user clicks a toolbar button in the React toolbar
- **THEN** the button's action SHALL be dispatched to the EditorView
- **THEN** the editor SHALL receive focus after the action

### Requirement: Toolbar can be disabled
The system SHALL allow disabling the toolbar entirely by setting `toolbar={false}` or omitting the toolbar prop. When disabled, no toolbar SHALL be rendered and no toolbar-related extensions SHALL be added to the editor state.

#### Scenario: No toolbar
- **WHEN** the editor is configured with `toolbar={false}`
- **THEN** no toolbar SHALL be rendered
- **THEN** plugin-contributed toolbar items SHALL be ignored
