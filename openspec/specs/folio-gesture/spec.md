# folio-gesture Specification

## Purpose

Defines the page-mode gesture layer for the folio reader: horizontal
swipe detection via `@use-gesture/react`, the three-zone tap region
(prev/toggle UI/next), the scope rule that disables gestures in
scroll mode, and the boundary behavior at the first and last page of
the book.

## Requirements

### Requirement: Swipe navigation

In page mode, the system SHALL detect horizontal swipe gestures via `@use-gesture/react`. A left swipe (swipeX === -1) SHALL trigger a next-page turn. A right swipe (swipeX === 1) SHALL trigger a previous-page turn.

#### Scenario: Swipe left to advance
- **WHEN** the user swipes left on the content area in page mode
- **THEN** the reader navigates to the next page (or next chapter's first page if on the last page)

#### Scenario: Swipe right to go back
- **WHEN** the user swipes right on the content area in page mode
- **THEN** the reader navigates to the previous page (or previous chapter's last page if on the first page)

#### Scenario: Swipe in scroll mode
- **WHEN** the user swipes horizontally in scroll mode
- **THEN** no page navigation occurs — scroll mode uses native vertical scrolling

### Requirement: Tap zone navigation

In page mode, the content area SHALL be divided into three horizontal tap zones: left 30% (previous page), center 40% (toggle UI chrome), and right 30% (next page).

#### Scenario: Tap right zone
- **WHEN** the user taps the right 30% of the content area in page mode
- **THEN** the reader navigates to the next page

#### Scenario: Tap left zone
- **WHEN** the user taps the left 30% of the content area in page mode
- **THEN** the reader navigates to the previous page

#### Scenario: Tap center zone
- **WHEN** the user taps the center 40% of the content area in page mode
- **THEN** the UI chrome (toolbar, controls, TOC) toggles visibility

### Requirement: Gesture layer scope

The gesture layer SHALL only be active in page mode. In scroll mode, native browser scrolling and touch behavior SHALL not be intercepted.

#### Scenario: Scroll mode passthrough
- **WHEN** `readMode` is `'scroll'`
- **THEN** no swipe or tap zone handlers are attached to the content area

### Requirement: Boundary behavior

When the user attempts to navigate past the first page of the first chapter or past the last page of the last chapter, no navigation SHALL occur.

#### Scenario: At the beginning
- **WHEN** the user swipes right or taps the left zone while on chapter 0, page 0
- **THEN** nothing happens — no navigation, no error

#### Scenario: At the end
- **WHEN** the user swipes left or taps the right zone while on the last page of the last chapter
- **THEN** nothing happens
