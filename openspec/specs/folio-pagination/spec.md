## ADDED Requirements

### Requirement: Scroll mode

When `readMode` is `'scroll'`, the content area SHALL render as a plain vertically-scrollable container with no pagination logic. The full chapter content is visible via scrolling.

#### Scenario: Scroll mode rendering
- **WHEN** `state.readMode` is `'scroll'`
- **THEN** the content renders in a single vertical overflow container without column layout

#### Scenario: Progress tracking in scroll mode
- **WHEN** the user scrolls in scroll mode
- **THEN** `scrollOffset` in state updates and `onProgressChange` fires with `chapterFraction` based on `scrollTop / scrollHeight`

### Requirement: Page mode via CSS Multi-Column

When `readMode` is `'page'`, the content area SHALL use CSS `column-width` equal to the container width. The inner content element spans all columns. Only one column (page) is visible at a time via `overflow: hidden` on the container and `translateX(-pageIndex * containerWidth)` on the inner element, applied without CSS transition.

#### Scenario: Page mode column layout
- **WHEN** `state.readMode` is `'page'` and content fills 4 columns
- **THEN** `pageCount` is 4 and the visible page is determined by `pageIndex`

#### Scenario: Translate without transition
- **WHEN** `pageIndex` changes
- **THEN** the inner element's `translateX` updates instantly (no CSS transition) — animation is handled by the Ghost Snapshot layer

### Requirement: Page count calculation

Total pages SHALL be calculated as `Math.round(innerElement.scrollWidth / container.clientWidth)`. This value SHALL be recalculated on: component mount, `ResizeObserver` callback, `document.fonts.ready` resolution, and image `onload` events within the content.

#### Scenario: Font load triggers recalculation
- **WHEN** `document.fonts.ready` resolves after content mount
- **THEN** `pageCount` is recalculated and `state.pageCount` updates

#### Scenario: Resize triggers recalculation
- **WHEN** the container is resized (orientation change, window resize)
- **THEN** `pageCount` is recalculated and `pageIndex` is clamped to the valid range

### Requirement: Mode switching

The user SHALL be able to switch between `'scroll'` and `'page'` modes at any time via `dispatch({ type: 'SET_READ_MODE', mode })`. Position SHALL be approximately preserved across mode switches.

#### Scenario: Switch from scroll to page
- **WHEN** the user switches from scroll mode (at 60% scroll progress) to page mode
- **THEN** `pageIndex` is set to approximately 60% of `pageCount`

#### Scenario: Switch from page to scroll
- **WHEN** the user switches from page mode (page 3 of 10) to scroll mode
- **THEN** `scrollOffset` is set to approximately 30% of the scroll height
