## ADDED Requirements

### Requirement: Tree flattening to reading order

The system SHALL flatten the `FolioNode[]` tree depth-first into a `FlatChapter[]` array containing only leaf nodes (nodes with `fetch`). Each `FlatChapter` SHALL include `index: number` (position in reading order), `node: FolioNode` (reference), `depth: number` (tree depth), and `path: number[]` (tree path indices).

#### Scenario: Nested tree flattening
- **WHEN** a tree has `Part 1 > [Ch1, Ch2]` and `Part 2 > Section A > [Ch3]`
- **THEN** the flat array is `[{ index: 0, node: Ch1, depth: 1 }, { index: 1, node: Ch2, depth: 1 }, { index: 2, node: Ch3, depth: 2 }]`

#### Scenario: Branch nodes excluded from flat array
- **WHEN** a node has `children` but no `fetch`
- **THEN** it does not appear in the flat chapter array

### Requirement: Seamless chapter auto-advance

When the user navigates past the last page of a chapter, the system SHALL automatically advance to the first page of the next chapter without any interstitial, break page, or user confirmation.

#### Scenario: Auto-advance on last page
- **WHEN** the user is on the last page of chapter N and navigates forward
- **THEN** the reader displays page 0 of chapter N+1 seamlessly

#### Scenario: Auto-reverse on first page
- **WHEN** the user is on page 0 of chapter N (N > 0) and navigates backward
- **THEN** the reader displays the last page of chapter N-1

### Requirement: Chapter prefetching

The system SHALL prefetch the next chapter's content when the user is within `config.prefetchThreshold` pages of the end of the current chapter. The prefetch SHALL use the next chapter's `node.fetch()` with an `AbortSignal` that cancels if the user navigates away.

#### Scenario: Prefetch at threshold
- **WHEN** `prefetchThreshold` is 2 and the user reaches page `pageCount - 2`
- **THEN** the next chapter's `fetch()` is called in the background

#### Scenario: Prefetch cancellation
- **WHEN** a prefetch is in-flight and the user navigates to a different chapter (not the prefetched one)
- **THEN** the prefetch's `AbortSignal` is aborted

#### Scenario: Content already prefetched
- **WHEN** the user advances to a chapter whose content was already prefetched
- **THEN** the content displays immediately without a loading state

### Requirement: Position restoration with unitID priority

When `initialPosition` is provided, the system SHALL restore position using `chapterId` first: find the matching node `id` in the flat array and use its index. If no match is found, fall back to `chapterIndex`. If the index exceeds the flat array length, clamp to the last chapter.

#### Scenario: Restore by chapterId
- **WHEN** `initialPosition` has `chapterId: "abc-123"` and a leaf node with `id: "abc-123"` exists at flat index 7
- **THEN** the reader opens at chapter index 7

#### Scenario: chapterId not found, fallback to index
- **WHEN** `initialPosition` has `chapterId: "deleted-id"` which doesn't exist, and `chapterIndex: 3`
- **THEN** the reader opens at chapter index 3

#### Scenario: Index out of bounds
- **WHEN** `initialPosition` has `chapterIndex: 999` but only 50 chapters exist
- **THEN** the reader opens at chapter index 49 (last chapter)

### Requirement: FolioPosition and FolioProgress types

`FolioPosition` SHALL contain `chapterIndex: number`, optional `chapterId: string`, `pageIndex: number`, and optional `scrollOffset: number`. `FolioProgress` SHALL contain `position: FolioPosition`, `fraction: number` (0–1, overall), and `chapterFraction: number` (0–1, within current chapter).

#### Scenario: Progress callback on navigation
- **WHEN** the user navigates to page 5 of 20 in chapter 2 of 10
- **THEN** `onProgressChange` fires with `chapterFraction: 0.25` and `fraction` reflecting overall book position

### Requirement: Collapsible TOC panel

The system SHALL render a table-of-contents panel from the `FolioNode[]` tree. Branch nodes render as section headers with background colors graduated by depth. Leaf nodes render as flat chapter entries with no indentation, regardless of depth. The currently active chapter SHALL be visually highlighted.

#### Scenario: TOC depth styling
- **WHEN** the tree has depth-0 branches (parts) and depth-1 branches (sections)
- **THEN** depth-0 headers have the strongest background contrast, depth-1 have medium contrast, and leaves have the base background

#### Scenario: Tap leaf to navigate
- **WHEN** the user taps a leaf entry in the TOC
- **THEN** the reader navigates to that chapter's `chapterIndex`

### Requirement: Branch collapse and expand

Each branch node in the TOC SHALL be individually collapsible. When collapsed, its child entries (branches and leaves) are hidden. The TOC SHALL also provide "Expand All" and "Collapse All" global controls.

#### Scenario: Collapse a branch
- **WHEN** the user taps a branch header in the TOC
- **THEN** all children of that branch are hidden

#### Scenario: Expand all
- **WHEN** the user taps "Expand All"
- **THEN** all branches in the TOC are expanded, showing all entries

#### Scenario: Collapse all
- **WHEN** the user taps "Collapse All"
- **THEN** all branches are collapsed, showing only top-level entries

#### Scenario: Collapse state does not affect navigation
- **WHEN** branches are collapsed in the TOC
- **THEN** the flat reading order and `chapterIndex` are unaffected — only the TOC visual display changes
