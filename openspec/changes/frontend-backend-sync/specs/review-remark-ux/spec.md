## ADDED Requirements

### Requirement: Review editor character minimum

The review editor page SHALL enforce a 200-character minimum on the body field. A character counter SHALL display the current character count and the 200-character threshold. The submit button SHALL be disabled until the body reaches 200 characters. A validation message reading "Reviews must be at least 200 characters" (i18n key) SHALL appear when the user attempts to submit below the minimum.

#### Scenario: Character counter reflects input
- **WHEN** the user types into the review body field
- **THEN** the character counter updates in real time showing current count relative to the 200-character minimum

#### Scenario: Submit disabled below minimum
- **WHEN** the review body contains fewer than 200 characters
- **THEN** the submit button is disabled and cannot be clicked

#### Scenario: Submit enabled at minimum
- **WHEN** the review body reaches exactly 200 characters
- **THEN** the submit button becomes enabled

### Requirement: Review creation

The review creation page at `/review/new/:bookUnitId` SHALL allow an authenticated user to create a PostKind.REVIEW post. The form SHALL include a title field (stored in `extra.title`), a markdown body field with preview support, a rating selector (stored in `extra.rating`), and a target book derived from the route parameter `bookUnitId`. The system SHALL call the post creation API with `kind: 'REVIEW'`, `targetUnitId`, `body`, and `extra` containing `title` and `rating`.

#### Scenario: Successful review creation
- **WHEN** an authenticated user fills in title, body (200+ characters), and rating, then submits
- **THEN** the system creates a post with `kind: 'REVIEW'`, `targetUnitId` set to the book's unit ID, `body` set to the markdown content, and `extra` containing `title` and `rating`

#### Scenario: Rating is optional
- **WHEN** a user submits a review without selecting a rating
- **THEN** the review is created with `extra.rating` absent or null

#### Scenario: Markdown body with preview
- **WHEN** the user writes markdown in the body field
- **THEN** a preview mode SHALL render the markdown as formatted content

### Requirement: Review editing

The review edit page at `/review/:reviewId/edit` SHALL load the existing review data and populate the title, body, and rating fields with the current values. The system SHALL preserve all existing data fields not modified by the user. The same 200-character minimum enforcement SHALL apply to the body during editing.

#### Scenario: Existing data populated on edit
- **WHEN** a user navigates to the edit page for an existing review
- **THEN** the title field shows `extra.title`, the body field shows the current markdown body, and the rating selector shows `extra.rating`

#### Scenario: Partial update preserves unmodified fields
- **WHEN** a user changes only the title and submits
- **THEN** the body and rating remain unchanged in the updated post

### Requirement: Review detail page

The review detail page at `/review/:reviewId` SHALL display the full review article including the title, author information, rating (if present), full rendered markdown body, creation timestamp, and book context (book title and link to the book detail page). Reaction counts (likes, replies) SHALL be visible.

#### Scenario: Full review rendered
- **WHEN** a user navigates to a review detail page
- **THEN** the page displays the review title, author, rating, fully rendered markdown body, timestamp, reaction counts, and a link to the target book

#### Scenario: Review without rating
- **WHEN** a review has no `extra.rating` value
- **THEN** the rating display is omitted and the remaining content renders normally

### Requirement: Review browse and search pages

The system SHALL provide a review landing page at `/review` showing curated review content and a review search page at `/review/search` with full filtering and sorting capabilities. Both pages SHALL display review cards with title, author, rating, word count, excerpt, and target book reference.

#### Scenario: Review landing page
- **WHEN** a user navigates to `/review`
- **THEN** the page displays curated review content (e.g., trending, recent, featured)

#### Scenario: Review search page
- **WHEN** a user navigates to `/review/search`
- **THEN** the page provides search input and filter controls, displaying matching reviews with pagination

### Requirement: Remark inline creation form

The book detail review tab SHALL display an inline remark creation form below the rating overview. The form SHALL contain a star rating selector and a text input field with a submit button. The form SHALL be available to authenticated users without requiring page navigation. There SHALL be no character limit on the remark body.

#### Scenario: Authenticated user sees remark form
- **WHEN** an authenticated user views the review tab of a book detail page
- **THEN** the inline remark creation form is visible with a star rating selector, text input, and submit button

#### Scenario: Unauthenticated user cannot create remark
- **WHEN** an unauthenticated user views the review tab
- **THEN** the inline remark creation form is either hidden or replaced with a prompt to sign in

### Requirement: Remark creation API call

When a user submits the inline remark form, the system SHALL create a post with `kind: 'REMARK'`, `targetUnitId` set to the book's unit ID, `body` set to the entered text, and `extra.rating` set to the selected star rating (if provided). The rating SHALL be optional.

#### Scenario: Remark with rating
- **WHEN** a user selects 4 stars, types "Great read", and submits
- **THEN** the system creates a post with `kind: 'REMARK'`, `targetUnitId` matching the book, `body: "Great read"`, and `extra: { rating: 4 }`

#### Scenario: Remark without rating
- **WHEN** a user types text but does not select a star rating, then submits
- **THEN** the system creates a post with `kind: 'REMARK'`, the entered body text, and `extra.rating` absent or null

#### Scenario: Form clears after submission
- **WHEN** the remark is successfully created
- **THEN** the text input and star rating selector reset to their default empty states and the new remark appears in the remark list

### Requirement: Remark list display

The remark list SHALL display remarks as compact cards. Each card SHALL show the author name, star rating (if present), remark text, reaction counts (likes, replies), and timestamp. The list SHALL be paginated and sorted by creation time descending.

#### Scenario: Compact card layout
- **WHEN** the remark sub-tab is active on the book detail review tab
- **THEN** remarks are displayed as compact cards with author, rating, text, reactions, and timestamp

#### Scenario: Remark without rating in list
- **WHEN** a remark has no `extra.rating`
- **THEN** the card omits the star rating display and shows the remaining fields normally

#### Scenario: Paginated remark list
- **WHEN** more remarks exist than fit on a single page
- **THEN** the list provides pagination controls to load additional remarks

### Requirement: Rating overview component (mocked)

The rating overview component SHALL display an average score, total rating count, and a rating distribution chart. This component SHALL be annotated with `// TODO: rating system being refactored` and SHALL use mocked data for the distribution breakdown. The average and count MAY read from existing rating query data where available.

#### Scenario: Mocked distribution display
- **WHEN** the rating overview component renders on the book detail review tab
- **THEN** it displays an average score, total count, and a distribution chart, with the distribution data sourced from mock values annotated with TODO comments

#### Scenario: Graceful display with no ratings
- **WHEN** a book has no ratings
- **THEN** the rating overview displays a zero or empty state without errors

### Requirement: Rating input component (mocked)

The rating input component SHALL provide a star selector allowing users to choose a rating value. This component SHALL be annotated with `// TODO: rating system being refactored` and SHALL use a mocked implementation. The component MUST emit the selected rating value to its parent form.

#### Scenario: Star selection
- **WHEN** a user clicks on the third star in the rating input
- **THEN** the component visually highlights stars 1 through 3 and emits the value 3 to the parent

#### Scenario: Clear selection
- **WHEN** a user clicks the currently selected star again
- **THEN** the rating selection is cleared and the component emits a null value

### Requirement: Book detail review tab layout

The book detail review tab at `/book/:bookId/review` SHALL present content in the following order from top to bottom: (1) rating overview component, (2) inline remark creation form, (3) sub-tab toggle between "Remarks" and "Reviews", (4) the active sub-tab content (remark list or review list). A "Write a Full Review" link SHALL be visible and navigate to `/review/new/:bookUnitId`.

#### Scenario: Default sub-tab is Remarks
- **WHEN** a user navigates to the book detail review tab
- **THEN** the Remarks sub-tab is active by default and the remark list is displayed

#### Scenario: Toggle to Reviews sub-tab
- **WHEN** a user clicks the "Reviews" sub-tab toggle
- **THEN** the review list replaces the remark list, showing article preview cards with title, rating, word count, excerpt, and reactions

#### Scenario: Write a Full Review link
- **WHEN** a user clicks the "Write a Full Review" link
- **THEN** the user is navigated to `/review/new/:bookUnitId` where `bookUnitId` corresponds to the current book

### Requirement: Reaction counts on reviews and remarks

Both review cards and remark cards SHALL display reaction counts including likes and reply counts. These counts SHALL be sourced from the `reactionSummaries` and `replyCount` fields on the post DTO.

#### Scenario: Review card with reactions
- **WHEN** a review has 12 likes and 3 replies
- **THEN** the review card displays the like count as 12 and reply count as 3

#### Scenario: Remark card with reactions
- **WHEN** a remark has 5 likes and 1 reply
- **THEN** the remark card displays the like count as 5 and reply count as 1

#### Scenario: Zero reactions
- **WHEN** a post has no reactions and no replies
- **THEN** the card displays zero counts or omits the reaction display gracefully

### Requirement: Reviews-by-book page

The system SHALL provide a page at `/review/book/:bookId` that lists all reviews targeting the specified book. Reviews SHALL be displayed as article preview cards with title, author, rating, word count, excerpt, and reaction counts. The list SHALL be paginated.

#### Scenario: Reviews filtered by book
- **WHEN** a user navigates to `/review/book/:bookId`
- **THEN** the page displays only reviews (PostKind.REVIEW) whose `targetUnitId` matches the book's unit ID

#### Scenario: Empty review list
- **WHEN** a book has no reviews
- **THEN** the page displays an empty state message

### Requirement: Remarks-by-book page

The system SHALL provide a page at `/remark/book/:bookId` that lists all remarks targeting the specified book. Remarks SHALL be displayed as compact cards with author, rating, text, reaction counts, and timestamp. The list SHALL be paginated.

#### Scenario: Remarks filtered by book
- **WHEN** a user navigates to `/remark/book/:bookId`
- **THEN** the page displays only remarks (PostKind.REMARK) whose `targetUnitId` matches the book's unit ID

#### Scenario: Empty remark list
- **WHEN** a book has no remarks
- **THEN** the page displays an empty state message
