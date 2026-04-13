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

The review creation page at `/review/new/:bookUnitId` SHALL allow an authenticated user to create a PostKind.REVIEW post. The form SHALL include a title field (stored in `extra.title`), a markdown body field with preview support, a score selector (1-10, persisted via `scoreApi.upsertScore()`), and a target book derived from the route parameter `bookUnitId`. When a score is provided, the system SHALL first upsert a ScoreEntry, then create the post with `kind: 'REVIEW'`, `targetUnitId`, `body`, `extra` containing `title`, and `scoreEntryId` linking to the upserted ScoreEntry.

#### Scenario: Successful review creation with score
- **WHEN** an authenticated user fills in title, body (200+ characters), and score (e.g. 8), then submits
- **THEN** the system upserts a ScoreEntry with `{ unitId: bookUnitId, realm: defaultRealmId, value: 8 }`, then creates a post with `kind: 'REVIEW'`, `targetUnitId` set to the book's unit ID, `body` set to the markdown content, `extra` containing `title`, and `scoreEntryId` pointing to the upserted ScoreEntry

#### Scenario: Score is optional
- **WHEN** a user submits a review without selecting a score
- **THEN** the review is created with no `scoreEntryId` (no ScoreEntry created)

#### Scenario: Markdown body with preview
- **WHEN** the user writes markdown in the body field
- **THEN** a preview mode SHALL render the markdown as formatted content

### Requirement: Review editing

The review edit page at `/review/:reviewId/edit` SHALL load the existing review data and populate the title, body, and score fields with the current values. The existing score SHALL be loaded via `scoreQueries.userScores(userId, bookUnitId)` to populate the score selector. The system SHALL preserve all existing data fields not modified by the user. The same 200-character minimum enforcement SHALL apply to the body during editing.

#### Scenario: Existing data populated on edit
- **WHEN** a user navigates to the edit page for an existing review
- **THEN** the title field shows `extra.title`, the body field shows the current markdown body, and the score selector shows the current score from the linked ScoreEntry

#### Scenario: Score change on edit
- **WHEN** a user changes the score and submits
- **THEN** the system calls `useUpsertScoreMutation()` with the new value (upserting on the same `(userId, unitId, realm)` key), and the post's `scoreEntryId` remains unchanged

#### Scenario: Partial update preserves unmodified fields
- **WHEN** a user changes only the title and submits
- **THEN** the body and score remain unchanged

### Requirement: Review detail page

The review detail page at `/review/:reviewId` SHALL display the full review article including the title, author information, score (if a ScoreEntry is linked), full rendered markdown body, creation timestamp, and book context (book title and link to the book detail page). Reaction counts (likes, replies) SHALL be visible.

#### Scenario: Full review rendered
- **WHEN** a user navigates to a review detail page
- **THEN** the page displays the review title, author, score, fully rendered markdown body, timestamp, reaction counts, and a link to the target book

#### Scenario: Review without score
- **WHEN** a review has no linked ScoreEntry (`scoreEntryId` is null)
- **THEN** the score display is omitted and the remaining content renders normally

### Requirement: Review browse and search pages

The system SHALL provide a review landing page at `/review` showing curated review content and a review search page at `/review/search` with full filtering and sorting capabilities. Both pages SHALL display review cards with title, author, score, word count, excerpt, and target book reference.

#### Scenario: Review landing page
- **WHEN** a user navigates to `/review`
- **THEN** the page displays curated review content (e.g., trending, recent, featured)

#### Scenario: Review search page
- **WHEN** a user navigates to `/review/search`
- **THEN** the page provides search input and filter controls, displaying matching reviews with pagination

### Requirement: Remark inline creation form

The book detail review tab SHALL display an inline remark creation form below the score overview. The form SHALL contain a score selector (1-10) and a text input field with a submit button. The form SHALL be available to authenticated users without requiring page navigation. There SHALL be no character limit on the remark body.

#### Scenario: Authenticated user sees remark form
- **WHEN** an authenticated user views the review tab of a book detail page
- **THEN** the inline remark creation form is visible with a score selector (1-10), text input, and submit button

#### Scenario: Unauthenticated user cannot create remark
- **WHEN** an unauthenticated user views the review tab
- **THEN** the inline remark creation form is either hidden or replaced with a prompt to sign in

### Requirement: Remark creation API call

When a user submits the inline remark form, the system SHALL first upsert a ScoreEntry (if a score was selected) via `scoreApi.upsertScore({ unitId, realm: defaultRealmId, value })`, then create a post with `kind: 'REMARK'`, `targetUnitId` set to the book's unit ID, `body` set to the entered text, and `scoreEntryId` set to the ScoreEntry's id (if a score was provided). The score SHALL be optional.

#### Scenario: Remark with score
- **WHEN** a user selects score 7, types "Great read", and submits
- **THEN** the system upserts a ScoreEntry with `{ unitId: bookUnitId, realm: defaultRealmId, value: 7 }`, then creates a post with `kind: 'REMARK'`, `targetUnitId` matching the book, `body: "Great read"`, and `scoreEntryId` pointing to the upserted ScoreEntry

#### Scenario: Remark without score
- **WHEN** a user types text but does not select a score, then submits
- **THEN** the system creates a post with `kind: 'REMARK'`, the entered body text, and no `scoreEntryId`

#### Scenario: Form clears after submission
- **WHEN** the remark is successfully created
- **THEN** the text input and score selector reset to their default empty states and the new remark appears in the remark list

### Requirement: Remark list display

The remark list SHALL display remarks as compact cards. Each card SHALL show the author name, score (if a ScoreEntry is linked), remark text, reaction counts (likes, replies), and timestamp. The list SHALL be paginated and sorted by creation time descending.

#### Scenario: Compact card layout
- **WHEN** the remark sub-tab is active on the book detail review tab
- **THEN** remarks are displayed as compact cards with author, score, text, reactions, and timestamp

#### Scenario: Remark without score in list
- **WHEN** a remark has no linked ScoreEntry
- **THEN** the card omits the score display and shows the remaining fields normally

#### Scenario: Paginated remark list
- **WHEN** more remarks exist than fit on a single page
- **THEN** the list provides pagination controls to load additional remarks

### Requirement: Score overview component

The score overview component SHALL display an average score, total score count, and a score distribution chart. The component SHALL use `scoreQueries.aggregates(unitId)` to fetch `ScoreAggregateDTO[]` and select the default realm's aggregate. The average SHALL be computed as `totalScore / totalCount`. The distribution chart SHALL render the real histogram from `ScoreAggregateDTO.distribution` (keys "1" through "10").

#### Scenario: Real distribution display
- **WHEN** the score overview component renders on the book detail review tab
- **THEN** it displays the average score, total count, and a distribution chart using real data from `ScoreAggregateDTO.distribution`

#### Scenario: Graceful display with no scores
- **WHEN** a book has no scores (no ScoreAggregate exists)
- **THEN** the score overview displays a zero or empty state without errors

### Requirement: Score input component

The score input component SHALL provide a 1-10 score selector (segmented control or similar) allowing users to choose an integer score value. The component MUST emit the selected score value to its parent form. When used in a creation flow, the parent form SHALL call `scoreMutations.useUpsertScore()` with the selected value to persist the ScoreEntry.

#### Scenario: Score selection
- **WHEN** a user selects the value 7 on the score input
- **THEN** the component visually highlights the selection and emits the value 7 to the parent

#### Scenario: Clear selection
- **WHEN** a user clicks a clear/reset control on the score input
- **THEN** the score selection is cleared and the component emits a null value

### Requirement: Book detail review tab layout

The book detail review tab at `/book/:bookId/review` SHALL present content in the following order from top to bottom: (1) score overview component, (2) inline remark creation form, (3) sub-tab toggle between "Remarks" and "Reviews", (4) the active sub-tab content (remark list or review list). A "Write a Full Review" link SHALL be visible and navigate to `/review/new/:bookUnitId`.

#### Scenario: Default sub-tab is Remarks
- **WHEN** a user navigates to the book detail review tab
- **THEN** the Remarks sub-tab is active by default and the remark list is displayed

#### Scenario: Toggle to Reviews sub-tab
- **WHEN** a user clicks the "Reviews" sub-tab toggle
- **THEN** the review list replaces the remark list, showing article preview cards with title, score, word count, excerpt, and reactions

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

The system SHALL provide a page at `/review/book/:bookId` that lists all reviews targeting the specified book. Reviews SHALL be displayed as article preview cards with title, author, score, word count, excerpt, and reaction counts. The list SHALL be paginated.

#### Scenario: Reviews filtered by book
- **WHEN** a user navigates to `/review/book/:bookId`
- **THEN** the page displays only reviews (PostKind.REVIEW) whose `targetUnitId` matches the book's unit ID

#### Scenario: Empty review list
- **WHEN** a book has no reviews
- **THEN** the page displays an empty state message

### Requirement: Remarks-by-book page

The system SHALL provide a page at `/remark/book/:bookId` that lists all remarks targeting the specified book. Remarks SHALL be displayed as compact cards with author, score, text, reaction counts, and timestamp. The list SHALL be paginated.

#### Scenario: Remarks filtered by book
- **WHEN** a user navigates to `/remark/book/:bookId`
- **THEN** the page displays only remarks (PostKind.REMARK) whose `targetUnitId` matches the book's unit ID

#### Scenario: Empty remark list
- **WHEN** a book has no remarks
- **THEN** the page displays an empty state message
