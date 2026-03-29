## ADDED Requirements

### Requirement: JSON syntax highlighting
The system SHALL provide a `json()` plugin that enables JSON syntax highlighting using `@codemirror/lang-json`. The highlighting SHALL cover strings, numbers, booleans, null, property keys, brackets, and colons.

#### Scenario: JSON content is highlighted
- **WHEN** the user types `{"name": "test", "count": 42, "active": true}` in an editor with the JSON plugin
- **THEN** property keys SHALL be highlighted differently from string values
- **THEN** numbers and booleans SHALL be highlighted with their respective styles

### Requirement: JSON formatting command
The system SHALL provide a `formatJson` command that formats the entire editor content as indented JSON. The command SHALL use `JSON.stringify(JSON.parse(text), null, 2)` for formatting. When the content is not valid JSON, the command SHALL NOT modify the content and SHALL trigger the lint diagnostics to display the parse error.

#### Scenario: Format valid JSON
- **WHEN** the editor contains `{"a":1,"b":[2,3]}` and the user invokes `formatJson`
- **THEN** the content SHALL be replaced with the pretty-printed equivalent with 2-space indentation

#### Scenario: Format invalid JSON
- **WHEN** the editor contains `{"a": 1,}` (trailing comma) and the user invokes `formatJson`
- **THEN** the content SHALL NOT change
- **THEN** the lint panel SHALL display the JSON parse error with its position

### Requirement: JSON real-time linting
The system SHALL provide a `jsonLint()` plugin that validates the editor content as JSON in real time using `@codemirror/lint`. Parse errors SHALL be displayed as lint diagnostics with the error position highlighted in the editor.

#### Scenario: Lint error on invalid JSON
- **WHEN** the user types `{"key": value}` (unquoted value)
- **THEN** a lint diagnostic SHALL appear at the position of `value` indicating a parse error

#### Scenario: No lint errors on valid JSON
- **WHEN** the editor contains valid JSON
- **THEN** no lint diagnostics SHALL be displayed

### Requirement: JSON default keybindings
The JSON plugin SHALL register `Shift-Mod-f` → `formatJson` as a default keybinding. This binding SHALL be overridable by consumer keybindings.

#### Scenario: Shift-Mod-f triggers format
- **WHEN** the user presses `Shift-Mod-f` with the JSON plugin active
- **THEN** `formatJson` SHALL be invoked

### Requirement: JSON toolbar items
The JSON plugin SHALL contribute a default set of toolbar items: a "Format" button that invokes `formatJson`.

#### Scenario: Format button in toolbar
- **WHEN** the JSON plugin is active with a toolbar
- **THEN** a "Format" button SHALL appear in the toolbar

### Requirement: jsonFull preset bundle
The system SHALL provide a `jsonFull()` factory function that bundles the JSON core plugin (language, keybindings, toolbar) with the JSON linting plugin. The lint plugin SHALL be included by default and disablable via `jsonFull({ lint: false })`.

#### Scenario: Full JSON preset
- **WHEN** `jsonFull()` is used
- **THEN** the editor SHALL have JSON syntax highlighting, formatting keybinding, toolbar items, and real-time linting

#### Scenario: JSON preset without lint
- **WHEN** `jsonFull({ lint: false })` is used
- **THEN** the editor SHALL have JSON syntax highlighting, formatting, and toolbar but no real-time linting
