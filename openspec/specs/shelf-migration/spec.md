# shelf-migration Specification

## Purpose

Defines the shelf-product surface that the legacy bookmark-era pages
migrated into: the `/shelf` landing page (curated/trending listings),
the `/shelf/search` page (Meilisearch full-text + tag filter +
pagination), and the `/shelf/:shelfId` detail page (metadata from
`translations[]`, items, view-mode switching). Scope is the page-level
behavior; the underlying data model and view-mode logic live in
sibling shelf specs.

## Requirements

### Requirement: Shelf landing page displays curated and trending shelves
The `/shelf` route SHALL render a landing page that presents curated and trending shelves to support shelf discovery. The page SHALL fetch shelf listings through `shelfApi.list()` and render each result using shelf cards.

#### Scenario: Landing page loads and displays shelves
- **WHEN** a user navigates to `/shelf`
- **THEN** the page SHALL call `shelfApi.list()` to retrieve shelf listings
- **AND** it SHALL render the results as shelf cards in a browsable layout
- **AND** it SHALL display a loading indicator while the data is being fetched

#### Scenario: Landing page handles empty state
- **WHEN** the shelf listing API returns zero results
- **THEN** the page SHALL display a meaningful empty-state message
- **AND** it SHALL NOT render an empty grid or broken layout

### Requirement: Shelf search page supports full-text search with filtering and pagination
The `/shelf/search` route SHALL provide full-text search over shelves using Meilisearch, with support for tag filtering and paginated results.

#### Scenario: User performs a text search for shelves
- **WHEN** a user enters a search query on the shelf search page
- **THEN** the page SHALL submit a full-text search request against the Meilisearch shelf index
- **AND** it SHALL display matching shelves as shelf cards

#### Scenario: User filters search results by tag
- **WHEN** a user selects one or more tag filters on the shelf search page
- **THEN** the search results SHALL be narrowed to shelves matching the selected tags
- **AND** the active filters SHALL be visually indicated

#### Scenario: Search results are paginated
- **WHEN** search results exceed one page of results
- **THEN** the page SHALL provide pagination controls to navigate between pages
- **AND** navigating between pages SHALL preserve the current search query and filters

### Requirement: Shelf detail page displays shelf metadata, items, and supports view mode switching
The `/shelf/:shelfId` route SHALL display the shelf's metadata (resolved from the shelf's `translations[]`), its items with keywords and labels, and allow the user to switch between grid, list, and review view modes.

#### Scenario: Shelf detail renders metadata from translations
- **WHEN** a user navigates to `/shelf/:shelfId`
- **THEN** the page SHALL call `shelfApi.get()` with the shelf ID
- **AND** it SHALL display the shelf title and description resolved from the shelf's `translations[]` in the user's preferred language

#### Scenario: Shelf items are displayed with keywords and labels
- **WHEN** the shelf detail page loads a shelf with items
- **THEN** each item SHALL display its associated keywords and labels
- **AND** items SHALL respect the shelf's defined sort order

#### Scenario: User switches view mode
- **WHEN** a user toggles between grid, list, and review view modes on the shelf detail page
- **THEN** the item layout SHALL re-render in the selected mode
- **AND** the selected view mode SHALL persist within the session

#### Scenario: Review view mode displays attached reviews
- **WHEN** the user selects the review view mode
- **THEN** items that have an attached ShelfItemReview SHALL display the review content inline alongside the item

### Requirement: Shelf creation supports title, description, and tags
The `/shelf/new` route SHALL provide a form for creating a new shelf with a title, description (both stored as translations), and tags. Submission SHALL call `shelfApi.create()`.

#### Scenario: User creates a shelf with required fields
- **WHEN** an authenticated user fills in the title and submits the shelf creation form
- **THEN** the app SHALL call `shelfApi.create()` with the provided translations and tags
- **AND** upon success it SHALL navigate to the newly created shelf's detail page

#### Scenario: Title is required for shelf creation
- **WHEN** a user attempts to submit the shelf creation form without a title
- **THEN** the form SHALL display a validation error
- **AND** it SHALL NOT submit the creation request

#### Scenario: Unauthenticated user cannot access shelf creation
- **WHEN** an unauthenticated user navigates to `/shelf/new`
- **THEN** the app SHALL redirect the user to authenticate or deny access

### Requirement: Shelf editing supports metadata, item management, and keyword editing
The `/shelf/:shelfId/edit` route SHALL allow the shelf owner to edit metadata (title, description, tags), add or remove items, reorder items, and edit item keywords. Changes SHALL be persisted through the shelf API.

#### Scenario: Owner edits shelf metadata
- **WHEN** the shelf owner modifies the title, description, or tags on the edit page
- **THEN** the app SHALL call `shelfApi.update()` with the updated data
- **AND** the changes SHALL be reflected on the shelf detail page after saving

#### Scenario: Owner adds an item to the shelf
- **WHEN** the shelf owner adds a new item on the edit page
- **THEN** the item SHALL appear in the shelf's item list
- **AND** the item addition SHALL be persisted through the item operations API

#### Scenario: Owner removes an item from the shelf
- **WHEN** the shelf owner removes an item on the edit page
- **THEN** the item SHALL be removed from the shelf's item list
- **AND** the removal SHALL be persisted through the item operations API

#### Scenario: Owner reorders items in the shelf
- **WHEN** the shelf owner drags or moves an item to a new position
- **THEN** the item order SHALL update to reflect the new position
- **AND** the updated sort order SHALL be persisted

#### Scenario: Owner edits item keywords
- **WHEN** the shelf owner modifies keywords on a shelf item
- **THEN** the keyword changes SHALL be saved through the item operations API
- **AND** the updated keywords SHALL appear on the shelf detail page

#### Scenario: Non-owner cannot access the edit page
- **WHEN** a user who is not the shelf owner navigates to `/shelf/:shelfId/edit`
- **THEN** the app SHALL deny access or redirect the user away from the edit page

### Requirement: Shelves-by-book page shows shelves containing a specific book
The `/shelf/book/:bookId` route SHALL display all shelves that contain the specified book, allowing users to discover how a book is organized across different shelves.

#### Scenario: Page displays shelves containing the book
- **WHEN** a user navigates to `/shelf/book/:bookId`
- **THEN** the page SHALL fetch and display all shelves that include the specified book
- **AND** each result SHALL be rendered as a shelf card

#### Scenario: No shelves contain the book
- **WHEN** no shelves include the specified book
- **THEN** the page SHALL display an appropriate empty-state message

### Requirement: Shelf cards render shelf summary for list contexts
Shelf cards used in listings and search results SHALL display the shelf title (resolved from `translations[]`), item count, and tags.

#### Scenario: Shelf card displays core information
- **WHEN** a shelf card is rendered in any listing context
- **THEN** it SHALL display the title resolved from the shelf's `translations[]` in the user's preferred language
- **AND** it SHALL display the item count
- **AND** it SHALL display the shelf's tags

#### Scenario: Shelf card links to shelf detail
- **WHEN** a user clicks or activates a shelf card
- **THEN** the app SHALL navigate to the corresponding `/shelf/:shelfId` route

### Requirement: Navigation sidebar includes a Shelves entry
The application sidebar navigation SHALL include a "Shelves" entry that links to `/shelf`.

#### Scenario: Shelves entry is visible in the sidebar
- **WHEN** the application sidebar is rendered
- **THEN** it SHALL include a navigation entry labeled "Shelves"
- **AND** activating the entry SHALL navigate to `/shelf`

#### Scenario: Shelves entry replaces any former Readlists entry
- **WHEN** the sidebar is rendered
- **THEN** it SHALL NOT contain a "Readlists" entry or any reference to the readlist feature

### Requirement: Create menu includes a New Shelf entry
The application's create menu (used for creating new content) SHALL include a "New Shelf" entry that links to `/shelf/new`.

#### Scenario: New Shelf entry is present in the create menu
- **WHEN** the create menu is opened
- **THEN** it SHALL include an entry labeled "New Shelf"
- **AND** activating the entry SHALL navigate to `/shelf/new`

### Requirement: Footer product link updated from Readlists to Shelves
The application footer's product links section SHALL reference "Shelves" instead of "Readlists", linking to `/shelf`.

#### Scenario: Footer displays Shelves link
- **WHEN** the application footer is rendered
- **THEN** the product links section SHALL include a "Shelves" link pointing to `/shelf`
- **AND** it SHALL NOT include a "Readlists" link

### Requirement: Locale strings updated for shelf terminology
All Paraglide JSON locale message files SHALL replace readlist-related keys and translations with shelf equivalents. No readlist terminology SHALL remain in locale message files.

#### Scenario: en locale uses shelf terminology
- **WHEN** the en JSON message file is loaded
- **THEN** it SHALL contain shelf-related translation keys (e.g., shelf titles, descriptions, actions)
- **AND** it SHALL NOT contain any readlist-related translation keys

#### Scenario: zh-hans locale uses shelf terminology
- **WHEN** the zh-hans JSON message file is loaded
- **THEN** it SHALL contain shelf-related translation keys matching the en structure
- **AND** it SHALL NOT contain any readlist-related translation keys

### Requirement: URL builder maps UnitType.SHELF to the shelf route
The shared URL builder utility SHALL map `UnitType.SHELF` to `/shelf/:id`, producing correct URLs for shelf units.

#### Scenario: URL builder generates shelf URLs
- **WHEN** the URL builder is called with `UnitType.SHELF` and a shelf ID
- **THEN** it SHALL return a URL in the form `/shelf/:id`

#### Scenario: URL builder does not reference READLIST
- **WHEN** the URL builder is evaluated
- **THEN** it SHALL NOT contain a mapping for `UnitType.READLIST` or produce `/readlist/*` URLs

### Requirement: Readlist feature directory is deleted
The `readlist/` feature directory and all its contents SHALL be removed from the frontend application. No readlist routes, components, or logic SHALL remain.

#### Scenario: Readlist directory no longer exists
- **WHEN** the frontend source tree is inspected
- **THEN** there SHALL be no `readlist/` feature directory
- **AND** there SHALL be no route definitions for `/readlist/*`

#### Scenario: No imports reference the readlist feature
- **WHEN** the frontend codebase is compiled
- **THEN** there SHALL be no import statements referencing modules from a `readlist/` directory

### Requirement: Content-search hacks for shelf listing are replaced with shelfApi.list()
All instances where content-search was used as a workaround to list shelves SHALL be replaced with direct calls to `shelfApi.list()`. No content-search-based shelf listing hacks SHALL remain.

#### Scenario: Shelf listings use shelfApi.list()
- **WHEN** any component or page needs to display a list of shelves
- **THEN** it SHALL use `shelfApi.list()` to fetch the data
- **AND** it SHALL NOT use content-search queries as a substitute for the shelf listing API

#### Scenario: No MOCK annotations remain for shelf listing
- **WHEN** the frontend codebase is searched for `// MOCK:` annotations related to shelf or readlist listing
- **THEN** no such annotations SHALL be found

### Requirement: HorizontalShelfCarousel component for homepage and landing use
A `HorizontalShelfCarousel` component SHALL be provided for embedding horizontally scrollable shelf previews in the homepage and other landing contexts. It SHALL accept a shelf data source and render shelf cards in a carousel layout.

#### Scenario: Carousel renders shelf cards horizontally
- **WHEN** the HorizontalShelfCarousel is rendered with shelf data
- **THEN** it SHALL display shelf cards in a horizontally scrollable layout
- **AND** users SHALL be able to scroll or swipe through the cards

#### Scenario: Carousel handles empty data
- **WHEN** the HorizontalShelfCarousel receives an empty data set
- **THEN** it SHALL render gracefully without errors
- **AND** it SHALL either hide itself or display an appropriate empty state
