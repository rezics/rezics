## ADDED Requirements

### Requirement: Ecosystem homepage with library section cards

The homepage SHALL display a library section cards area containing cards for Book Library, Game Library, and Media Library. Each card SHALL present the library name and a visual identity. The Book Library card SHALL be in an active state. The Game Library and Media Library cards SHALL be in a "Coming Soon" state.

#### Scenario: Visitor views the homepage library cards

- **WHEN** a user navigates to the homepage `/`
- **THEN** the page SHALL display library section cards for Book Library, Game Library, and Media Library

#### Scenario: Coming Soon libraries are visually distinguished

- **WHEN** the library cards are rendered
- **THEN** Game Library and Media Library cards SHALL display a "Coming Soon" indicator
- **AND** they SHALL NOT be interactive links

### Requirement: Library card content and state

The Book Library card SHALL display the library name, the total item count (number of books), and an "Enter" action linking to `/book`. Game Library and Media Library cards SHALL display their names and a "Coming Soon" label with no interactive action.

#### Scenario: Book Library card shows item count and Enter action

- **WHEN** the Book Library card is rendered
- **THEN** it SHALL display the library name, the current book item count, and an "Enter" action

#### Scenario: Book Library card links to /book

- **WHEN** a user activates the "Enter" action on the Book Library card
- **THEN** the application SHALL navigate to `/book`

#### Scenario: Coming Soon card has no actionable link

- **WHEN** a user views the Game Library or Media Library card
- **THEN** the card SHALL NOT provide a navigable link or "Enter" action

### Requirement: Featured content sections on homepage

The homepage SHALL include four content preview sections: a featured books preview, trending shelves, recent reviews, and active realms. Each section SHALL display a compact preview of 3 to 5 items. The featured books preview SHALL link to `/book` for the full book library experience.

#### Scenario: Featured books preview displays items

- **WHEN** the homepage is loaded
- **THEN** a "Latest Works" section SHALL display a preview of 3 to 5 book items with a "See all" link to `/book`

#### Scenario: Trending shelves section displays items

- **WHEN** the homepage is loaded
- **THEN** a "Trending Shelves" section SHALL display 3 to 5 shelf cards

#### Scenario: Recent reviews section displays items

- **WHEN** the homepage is loaded
- **THEN** a "Recent Reviews" section SHALL display 3 to 5 review preview cards

#### Scenario: Active realms section displays items

- **WHEN** the homepage is loaded
- **THEN** an "Active Realms" section SHALL display 3 to 5 realm cards

### Requirement: Section "See all" navigation

Each content preview section on the homepage SHALL include a "See all" link that navigates to the dedicated landing page for that content type. Featured books SHALL link to `/book`, trending shelves to `/shelf`, recent reviews to `/review`, and active realms to `/realm`.

#### Scenario: Featured books "See all" navigates to /book

- **WHEN** a user activates the "See all" link in the featured books section
- **THEN** the application SHALL navigate to `/book`

#### Scenario: Trending shelves "See all" navigates to /shelf

- **WHEN** a user activates the "See all" link in the trending shelves section
- **THEN** the application SHALL navigate to `/shelf`

#### Scenario: Recent reviews "See all" navigates to /review

- **WHEN** a user activates the "See all" link in the recent reviews section
- **THEN** the application SHALL navigate to `/review`

#### Scenario: Active realms "See all" navigates to /realm

- **WHEN** a user activates the "See all" link in the active realms section
- **THEN** the application SHALL navigate to `/realm`

### Requirement: Announcements section

The homepage SHALL retain the existing announcements section powered by EchoKV. The announcements section SHALL continue to display system announcements using the current EchoKV integration.

#### Scenario: Announcements render from EchoKV

- **WHEN** the homepage is loaded and EchoKV contains announcement entries
- **THEN** the announcements section SHALL display those entries

#### Scenario: No announcements available

- **WHEN** the homepage is loaded and EchoKV contains no announcement entries
- **THEN** the announcements section SHALL either be hidden or display an empty state

### Requirement: Hero section with REZICS branding

The homepage SHALL display a hero section at the top containing the REZICS brand identity and a unified search bar. The hero kicker text SHALL display "REZICS" (not "Library Book"). The search bar SHALL allow users to search across all content types.

#### Scenario: Hero section displays REZICS branding

- **WHEN** a user navigates to the homepage `/`
- **THEN** the hero section SHALL display "REZICS" as the brand identity
- **AND** the hero SHALL NOT display "Library Book" or "Library.Book"

#### Scenario: Unified search bar searches across content types

- **WHEN** a user enters a query in the homepage search bar and submits
- **THEN** the application SHALL perform a search across all content types and display results

### Requirement: Book-specific sections relocated to /book landing

Book-specific editorial sections (trending books grid, trending quotes, quick access tag chips, full-size new books tabbed carousel) SHALL NOT appear on the homepage. These sections SHALL be located on the Book Library landing page at `/book`. The homepage MAY retain a compact "Latest Works" preview section (3-5 items) as a teaser.

#### Scenario: Homepage does not contain book-specific editorial sections

- **WHEN** a user views the homepage `/`
- **THEN** the page SHALL NOT display the trending books grid, trending quotes carousel, or quick access tag chips

#### Scenario: Homepage retains compact book preview

- **WHEN** a user views the homepage `/`
- **THEN** the page MAY display a compact "Latest Works" section with 3-5 items and a "See all" link to `/book`

#### Scenario: Book Library landing page contains book-specific sections

- **WHEN** a user navigates to `/book`
- **THEN** the page SHALL display book-specific editorial content including new books (tabbed), trending books, trending quotes, and quick access tags

### Requirement: Search route separation

Each content type SHALL have a search sub-route: `/book/search`, `/shelf/search`, `/review/search`, and `/realm/search`. These search pages SHALL provide the full search and filtering interface.

#### Scenario: Book search page at /book/search

- **WHEN** a user navigates to `/book/search`
- **THEN** the application SHALL display the book search page with full filtering capabilities

#### Scenario: Shelf search page at /shelf/search

- **WHEN** a user navigates to `/shelf/search`
- **THEN** the application SHALL display the shelf search page with full filtering capabilities

#### Scenario: Review search page at /review/search

- **WHEN** a user navigates to `/review/search`
- **THEN** the application SHALL display the review search page with full filtering capabilities

#### Scenario: Realm search page at /realm/search

- **WHEN** a user navigates to `/realm/search`
- **THEN** the application SHALL display the realm search page with full filtering capabilities

### Requirement: Search page filtering capabilities

Each search page SHALL support full Meilisearch-powered filtering including keyword search, tag filtering, NSFW content filtering, sort order selection, and language filtering.

#### Scenario: Keyword search filters results

- **WHEN** a user enters a keyword on a search page
- **THEN** the results SHALL be filtered to match the keyword

#### Scenario: Tag filtering narrows results

- **WHEN** a user selects one or more tags on a search page
- **THEN** the results SHALL be filtered to only include items matching the selected tags

#### Scenario: NSFW filter controls content visibility

- **WHEN** a user toggles the NSFW filter on a search page
- **THEN** the results SHALL include or exclude NSFW content accordingly

#### Scenario: Sort order changes result ordering

- **WHEN** a user selects a sort option on a search page
- **THEN** the results SHALL be reordered according to the selected sort criteria

#### Scenario: Language filter restricts results by language

- **WHEN** a user selects a language filter on a search page
- **THEN** the results SHALL be filtered to items in the selected language

### Requirement: Landing pages with curated content

The landing pages at `/book`, `/shelf`, `/review`, and `/realm` SHALL display curated and editorial content rather than search results. Each landing page SHALL serve as a discovery and browsing entry point for its content type.

#### Scenario: /book landing shows curated book content

- **WHEN** a user navigates to `/book`
- **THEN** the page SHALL display curated book content such as new releases, trending, and editorial picks

#### Scenario: /shelf landing shows curated shelf content

- **WHEN** a user navigates to `/shelf`
- **THEN** the page SHALL display curated shelf content for browsing and discovery

#### Scenario: /review landing shows curated review content

- **WHEN** a user navigates to `/review`
- **THEN** the page SHALL display curated review content for browsing and discovery

#### Scenario: /realm landing shows curated realm content

- **WHEN** a user navigates to `/realm`
- **THEN** the page SHALL display curated realm content for browsing and discovery

### Requirement: Homepage performance constraint

The homepage SHALL be lightweight by limiting each content preview section to 3 to 5 items. The homepage MUST NOT load full datasets or paginated lists for its preview sections.

#### Scenario: Preview sections are bounded in size

- **WHEN** the homepage is loaded
- **THEN** each content preview section (featured books, trending shelves, recent reviews, active realms) SHALL display no more than 5 items

#### Scenario: Homepage does not load full content lists

- **WHEN** the homepage fetches data for its preview sections
- **THEN** each data request SHALL be limited to a small fixed number of items (no more than 5)

### Requirement: Footer displays REZICS branding

The footer SHALL display "REZICS" as the platform brand name. The footer SHALL NOT display "Library.Book" or "Library Book". The brand description SHALL reflect the multi-library platform identity.

#### Scenario: Footer brand text is REZICS

- **WHEN** the footer renders on any page
- **THEN** the brand text SHALL display "REZICS"
- **AND** "Library.Book" or "Library Book" SHALL NOT appear

#### Scenario: Footer brand description reflects multi-library platform

- **WHEN** the footer renders
- **THEN** the brand description SHALL reference the broader platform scope (books, games, media) rather than only books
