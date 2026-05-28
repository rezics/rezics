# editor-scroll-sync Specification

## Purpose

Defines the bidirectional, line-based scroll synchronization between
the CodeMirror editor and the markdown preview pane in dual-column
view mode. The capability owns the source-line mapping, the loop
prevention that keeps one pane's sync from triggering the other, the
post-re-render scroll restoration that survives content edits, and
the `useScrollSync` hook that encapsulates listener setup and
teardown.

## Requirements

### Requirement: Bidirectional line-based scroll sync in dual mode

The system SHALL synchronize scroll positions between the CodeMirror editor and the markdown preview when in dual-column view mode. Synchronization SHALL be bidirectional: scrolling either pane SHALL update the other to show the corresponding content region.

The system SHALL use source-line numbers as the mapping key. The top visible line in the scrolled pane SHALL determine the scroll target in the opposite pane.

Scroll sync SHALL only be active when `viewMode === 'dual'`. It SHALL have no effect in write-only or preview-only modes.

#### Scenario: Editor scroll updates preview

- **WHEN** the user scrolls the CodeMirror editor in dual-column mode
- **THEN** the preview pane SHALL scroll to show the rendered HTML corresponding to the editor's top visible source line

#### Scenario: Preview scroll updates editor

- **WHEN** the user scrolls the preview pane in dual-column mode
- **THEN** the CodeMirror editor SHALL scroll to show the source line corresponding to the preview's topmost visible annotated element

#### Scenario: Sync inactive in write-only mode

- **WHEN** the view mode is `write`
- **THEN** no scroll synchronization listeners SHALL be active

#### Scenario: Sync inactive in preview-only mode

- **WHEN** the view mode is `preview`
- **THEN** no scroll synchronization listeners SHALL be active

### Requirement: Scroll loop prevention

The system SHALL prevent infinite scroll event loops caused by bidirectional sync. When pane A triggers a sync update to pane B, the resulting scroll event on pane B SHALL NOT trigger a reverse sync back to pane A.

#### Scenario: No feedback loop on editor scroll

- **WHEN** the editor fires a scroll event and the sync logic scrolls the preview
- **THEN** the preview's scroll event SHALL be suppressed for the current sync cycle
- **THEN** no reverse sync from preview to editor SHALL occur

#### Scenario: No feedback loop on preview scroll

- **WHEN** the preview fires a scroll event and the sync logic scrolls the editor
- **THEN** the editor's scroll event SHALL be suppressed for the current sync cycle
- **THEN** no reverse sync from editor to preview SHALL occur

### Requirement: Post-re-render scroll restoration

When the preview HTML is replaced due to content changes in dual-column mode, the system SHALL restore the preview's scroll position to match the editor's current scroll state.

#### Scenario: Typing preserves preview scroll position

- **WHEN** the user types in the editor while in dual-column mode
- **THEN** the preview's `innerHTML` SHALL be updated with the new rendered content
- **THEN** the preview's scroll position SHALL be restored to align with the editor's top visible line before the next paint

### Requirement: useScrollSync hook encapsulation

All scroll synchronization logic SHALL be encapsulated in a `useScrollSync` hook. The hook SHALL accept the `EditorView`, a ref to the preview container, and the current view mode. The hook SHALL manage all event listener setup and teardown.

#### Scenario: Hook cleanup on mode change

- **WHEN** the view mode changes from `dual` to `write`
- **THEN** all scroll event listeners SHALL be removed
- **THEN** no scroll sync processing SHALL occur
