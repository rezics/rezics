## ADDED Requirements

### Requirement: /book renders a curated book library homepage

The route `/book` SHALL render a curated book library homepage (`BookHomePage`) containing editorial and discovery sections for books. This page SHALL NOT render the book search/listing interface.

#### Scenario: User navigates to /book

- **WHEN** a user navigates to `/book`
- **THEN** the page SHALL display curated book content sections (new books, trending books, trending quotes, quick access tags)
- **AND** the page SHALL NOT display the full search interface with filters and pagination

#### Scenario: Book homepage loads without authentication

- **WHEN** an unauthenticated user navigates to `/book`
- **THEN** the page SHALL render all curated sections without requiring login

### Requirement: Book homepage includes a search entry point

The book library homepage SHALL include a visible search bar or search action that navigates to `/book/search`. Users SHALL be able to reach the full search interface from the book homepage.

#### Scenario: User initiates search from book homepage

- **WHEN** a user enters a query in the book homepage search bar and submits
- **THEN** the application SHALL navigate to `/book/search` with the query as a parameter

#### Scenario: Search bar is visible on book homepage

- **WHEN** the book homepage renders
- **THEN** a search entry point (search bar or search button) SHALL be visible without scrolling

### Requirement: Book homepage contains New Books section with tabs

The book homepage SHALL display a New Books section with three tabs: Latest Serial, New on Shelf, and Recently Completed. The section SHALL display up to 12 items per tab using horizontal carousel layout.

#### Scenario: New Books section renders with tabs

- **WHEN** the book homepage loads
- **THEN** the New Books section SHALL display three switchable tabs
- **AND** the default tab SHALL show latest serial books

#### Scenario: User switches New Books tab

- **WHEN** a user activates the "New on Shelf" tab
- **THEN** the section SHALL display books sorted by the corresponding criteria

### Requirement: Book homepage contains Trending Books section

The book homepage SHALL display a Trending Books section showing up to 12 books in a responsive grid layout.

#### Scenario: Trending Books section renders

- **WHEN** the book homepage loads
- **THEN** the Trending Books section SHALL display books in a responsive grid

### Requirement: Book homepage contains Trending Quotes section

The book homepage SHALL display a Trending Quotes section. When quote data is available, it SHALL show up to 8 quotes in a carousel. When quote data is unavailable, it SHALL display an empty state message.

#### Scenario: Trending Quotes section with data

- **WHEN** the book homepage loads and quote data is available
- **THEN** the Trending Quotes section SHALL display quotes in a carousel

#### Scenario: Trending Quotes section without data

- **WHEN** the book homepage loads and no quote data is available
- **THEN** the section SHALL display a localized empty state message

### Requirement: Book homepage contains Quick Access Tags

The book homepage SHALL display a quick access section with tag chips that link to book search filtered by the selected tag.

#### Scenario: User clicks a quick access tag

- **WHEN** a user activates a tag chip in the quick access section
- **THEN** the application SHALL navigate to `/book/search` with the selected tag as a filter parameter

### Requirement: Book search is at /book/search

The full book search interface (with keyword search, filters, sort, and pagination) SHALL be rendered at `/book/search`. This is the `BookLibPage` component.

#### Scenario: User navigates to /book/search

- **WHEN** a user navigates to `/book/search`
- **THEN** the page SHALL display the full book search interface with search input, sort controls, filters, and paginated results

#### Scenario: User navigates to /book/search with query parameter

- **WHEN** a user navigates to `/book/search?tags=fantasy`
- **THEN** the search page SHALL pre-populate the tag filter with "fantasy" and display filtered results

### Requirement: All book homepage sections use i18n

All section titles, tab labels, action labels, and empty states on the book homepage SHALL use `react-i18next` translation keys. No hardcoded Chinese or English display text SHALL appear.

#### Scenario: Book homepage renders in English

- **WHEN** the UI language is set to "en-US"
- **THEN** all section titles and labels on the book homepage SHALL display in English

#### Scenario: Book homepage renders in Japanese

- **WHEN** the UI language is set to "ja-JP"
- **THEN** all section titles and labels on the book homepage SHALL display in Japanese (or English fallback where Japanese translation is unavailable)
