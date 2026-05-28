# editor-emoji Specification

## Purpose

Provides the editor plugin that wires an emoji toolbar button into the
editor and lets a consumer supply its own picker UI. The plugin owns
the open/close state, the cursor/selection insertion behavior, and the
auto-close-on-scroll interaction; it does not bundle any emoji data or
picker component.

## Requirements

### Requirement: Emoji insertion plugin
The system SHALL provide an `emoji()` plugin that manages emoji insertion into the editor. The plugin SHALL provide a toolbar button and an open/close state for a consumer-provided emoji picker UI.

#### Scenario: Emoji toolbar button
- **WHEN** the emoji plugin is active and a toolbar is rendered
- **THEN** an "Emoji" button SHALL appear in the toolbar

### Requirement: Consumer-provided emoji picker
The emoji plugin SHALL accept a `renderPicker` configuration: a function `(onSelect: (emoji: string) => void, onClose: () => void) => ReactNode`. The plugin SHALL call this function to render the picker UI when the picker state is open. The plugin SHALL NOT bundle any emoji data or picker component.

#### Scenario: Picker opens on toolbar button click
- **WHEN** the user clicks the "Emoji" toolbar button
- **THEN** the picker state SHALL change to open
- **THEN** the `renderPicker` function SHALL be called to render the picker UI

#### Scenario: Picker closes on onClose
- **WHEN** the picker is open and `onClose` is invoked (e.g., user clicks outside or presses Escape)
- **THEN** the picker state SHALL change to closed
- **THEN** the picker UI SHALL be removed

### Requirement: Emoji insertion into editor
When an emoji is selected via the `onSelect` callback, the plugin SHALL insert the emoji string at the current cursor position or replace the current selection. The editor SHALL retain focus after insertion.

#### Scenario: Insert emoji at cursor
- **WHEN** the picker is open and the user selects "😀"
- **THEN** "😀" SHALL be inserted at the current cursor position
- **THEN** the cursor SHALL advance past the inserted emoji
- **THEN** the editor SHALL retain focus

#### Scenario: Insert emoji replacing selection
- **WHEN** text is selected and the user selects an emoji from the picker
- **THEN** the selected text SHALL be replaced with the emoji

### Requirement: Emoji picker closes on editor scroll
When the editor scrolls while the emoji picker is open, the picker SHALL close to prevent the picker from visually detaching from its anchor position.

#### Scenario: Scroll closes picker
- **WHEN** the emoji picker is open and the editor content scrolls
- **THEN** the picker SHALL close
