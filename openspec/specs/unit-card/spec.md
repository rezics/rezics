# unit-card Specification

## Purpose

Defines a reusable, fixed-height `UnitCard` component exported by the `unit`
feature that renders caller-supplied unit summary data. The card is the shared
presentation vocabulary used by shelf rows in unit view, search results, URL
import candidates, and contextual browse results. The component is data-driven
and SHALL NOT fetch data itself; it relies on translation-aware summary fields
and the app's shared user hover preview for author identity, uses rezics design
tokens, and ships with Storybook coverage for its fixed-height edge cases.

## Requirements

### Requirement: Unit card renders a reusable fixed-height unit summary

The app SHALL provide a reusable `UnitCard` component from the `unit` feature.
The card SHALL render from caller-supplied unit summary data and SHALL use a
stable fixed-height layout suitable for shelf rows, search results, URL
candidates, and browse results.

#### Scenario: Unit card renders core summary fields

- **WHEN** `UnitCard` receives a summary with image, title, kind, content
  preview, and added-time metadata
- **THEN** it SHALL render the image, title, kind, concise content, and metadata
  in a stable card layout
- **AND** the component SHALL NOT fetch data by itself

#### Scenario: Long content stays inside fixed height

- **WHEN** the summary title, author name, or content preview is long
- **THEN** the card SHALL clamp or truncate text so the card height remains
  stable
- **AND** text SHALL NOT overlap adjacent metadata or actions

### Requirement: Unit card supports translation-aware display fields

The `UnitCard` summary model SHALL support caller-supplied fields derived from
unit translations, including the chosen title, optional subtitle, optional
source or override title, and optional language metadata. The card SHALL render
only the fields that are present.

#### Scenario: Translation override metadata is present

- **WHEN** the summary includes an override title and source title
- **THEN** the card SHALL render the chosen display title as primary text
- **AND** it SHALL expose the source or override metadata as secondary text
  without replacing the primary title

#### Scenario: Optional translation metadata is missing

- **WHEN** the summary omits translation metadata
- **THEN** the card SHALL render the available title and content fields
- **AND** it SHALL NOT render placeholder translation labels

### Requirement: Unit card renders author identity through the shared preview

When author data is available, `UnitCard` SHALL render author identity through
the app's shared user hover preview affordance introduced by
`add-user-hover-preview`. The unit feature SHALL NOT implement a separate
author hover popover.

#### Scenario: Author data renders preview-capable identity

- **WHEN** the card receives a public author object with a usable user id
- **THEN** it SHALL render the author using the shared user hover preview
  component or public user feature export
- **AND** clicking the author affordance SHALL preserve profile navigation

#### Scenario: Author data is missing

- **WHEN** the card receives no author data
- **THEN** it SHALL omit the author affordance or render a non-interactive
  fallback
- **AND** it SHALL NOT render a broken profile link

### Requirement: Unit card uses rezics design tokens and accessible semantics

`UnitCard` SHALL use rezics design tokens for surfaces, text, borders, radius,
spacing, and focus states. Interactive elements in the card SHALL remain
keyboard-accessible and SHALL expose names suitable for assistive technology.

#### Scenario: Card styling uses token-backed classes

- **WHEN** the card source is inspected
- **THEN** custom styling SHALL use token-backed classes or CSS variables
- **AND** it SHALL NOT use raw hex colors or decorative gradient backgrounds

#### Scenario: Interactive card content is keyboard reachable

- **WHEN** a keyboard user tabs through a rendered `UnitCard`
- **THEN** actionable links and buttons SHALL be reachable in a logical order
- **AND** focus styling SHALL remain visible in both light and dark themes

### Requirement: Unit card has Storybook coverage

The change SHALL add Storybook stories for `UnitCard` covering default data,
missing media, long text, translation metadata, author preview integration, and
shelf-row metadata.

#### Scenario: Storybook covers fixed-height edge cases

- **WHEN** `UnitCard` stories are inspected
- **THEN** they SHALL include long title/content examples
- **AND** the rendered examples SHALL keep the same card height across those
  states
