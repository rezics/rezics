## ADDED Requirements

### Requirement: Search results use canonical card surfaces

Search result lists SHALL render result previews through app-level card
components backed by `@rezics/ui/shadcn` Card surfaces. Result lists SHALL NOT
use local border-row recipes for normal result items.

#### Scenario: Federated grouped results render cards

- **WHEN** the federated search result list renders a grouped response with
  visible section items
- **THEN** each result item SHALL render through `SearchLibraryUnitCard`,
  `SearchContentResultCard`, or an equivalent app card component backed by
  `@rezics/ui/shadcn` Card
- **AND** the result section itself SHALL remain an unframed page section

#### Scenario: Federated ranked results render cards

- **WHEN** the federated search result list renders a ranked response
- **THEN** each ranked hit SHALL render as a card-backed preview surface
- **AND** origin/category metadata SHALL remain visible on the preview

#### Scenario: Legacy content results render cards

- **WHEN** `SearchResultList` renders its default fallback item renderer
- **THEN** each content document SHALL render through the canonical search card
  surface vocabulary
- **AND** title resolution from the document's localized title arrays SHALL
  remain unchanged

### Requirement: Search result cards preserve preview behavior

Search result cards SHALL remain preview surfaces. They SHALL clamp long text,
preserve accessible media alternatives, and avoid document-flow behavior such as
expansion, replies, or reactions.

#### Scenario: Long result text is clamped

- **WHEN** a search result has a long title, summary, body, or metadata string
- **THEN** the rendered card SHALL clamp or truncate the text within the card
  without resizing neighboring result items unexpectedly

#### Scenario: Result media remains accessible

- **WHEN** a search result card renders a cover, thumbnail, avatar, or fallback
  media slot
- **THEN** meaningful media SHALL include an accessible text alternative
- **AND** decorative fallback media SHALL be hidden from assistive technologies

#### Scenario: Search preview excludes flow controls

- **WHEN** a post-like search result is rendered
- **THEN** the result SHALL present preview metadata and content
- **AND** it SHALL NOT render reply composers, reaction controls, or other
  document-flow controls inside the search result card
