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

The remark list SHALL display remarks as compact cards. Each card SHALL show the author name, score (if a ScoreEntry is linked), remark text, reaction counts (likes, replies), and timestamp. The list SHALL be paginated and sorted by creation time descending. When the remark query is settled and the remark collection is empty, the list SHALL render an `EmptyState` (per the `list-empty-state` capability) with localized copy rather than rendering an empty region.

#### Scenario: Compact card layout
- **WHEN** the remark sub-tab is active on the book detail review tab
- **THEN** remarks are displayed as compact cards with author, score, text, reactions, and timestamp

#### Scenario: Remark without score in list
- **WHEN** a remark has no linked ScoreEntry
- **THEN** the card omits the score display and shows the remaining fields normally

#### Scenario: Paginated remark list
- **WHEN** more remarks exist than fit on a single page
- **THEN** the list provides pagination controls to load additional remarks

#### Scenario: Empty remark list renders EmptyState
- **GIVEN** a book with zero remarks
- **WHEN** the remark list's query is settled (`!isLoading && !error`) and `posts.length === 0`
- **THEN** the list SHALL render `<EmptyState title={t("remark.list.empty.title")} …/>` from `@rezics/ui`
- **AND** the list SHALL NOT render an empty `<Stack>` or blank region

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

Both review cards and remark cards (in every list, carousel, and detail context) SHALL render a `<ReactionBar>` (per `engagement-reaction-bar`) using the content-as-artifact action policy. The `ReactionBar` SHALL display the net vote score and the reply count derived from `reactionSummaries` and `replyCount` on the post DTO. Review cards, remark cards, and their detail surfaces SHALL NOT render bespoke count displays (custom like-count `Typography`, `PostReactionFooter`, or `ReactionStatistics`); all count rendering goes through the `ReactionBar` atoms.

#### Scenario: Review card uses ReactionBar

- **WHEN** a `ReviewCard` renders a review with 12 net votes and 3 replies
- **THEN** the card's `<ReactionBar>` renders a vote pill showing "12" and a reply action showing "💬 3"
- **AND** no separate count text (e.g. "12 likes", "3 replies") renders outside the `ReactionBar`

#### Scenario: Remark card uses ReactionBar

- **WHEN** a `RemarkCard` renders a remark with 5 net votes and 1 reply
- **THEN** the card's `<ReactionBar>` renders a vote pill showing "5" and a reply action showing "💬 1"

#### Scenario: Zero counts still render a ReactionBar

- **WHEN** a review or remark has no votes and no replies
- **THEN** the card's `<ReactionBar>` still renders, with the vote pill showing "0" and the reply action showing "💬 Reply" (label instead of count)
- **AND** the card SHALL NOT omit the `ReactionBar` or degrade to a placeholder text

#### Scenario: Review and remark cards are fully interactive via ReactionBar

- **WHEN** a signed-in user clicks the up-arrow on a `ReviewCard` or `RemarkCard`
- **THEN** the vote mutation dispatches via the `VoteGroup` atom internal to `ReactionBar`
- **AND** the outer card navigation to the detail page SHALL NOT fire (click propagation is stopped by `ReactionBar` per the `engagement-reaction-bar` spec)

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
## Requirements
### Requirement: Review creation page

The review creation page at `/review/new/:bookUnitId` SHALL allow an authenticated user to create a PostKind.REVIEW post. The form SHALL include a title field (stored in `extra.title`), a markdown body field with preview support, a score input rendered per the `score-input-primitive` capability (rezics-owned `<RatingInput>` from `@rezics/ui`, `max = SCORE_MAX`, `precision = 1`, integer 1–10, persisted via `scoreApi.upsertScore()`), and a target book derived from the route parameter `bookUnitId`. When a score is provided, the system SHALL first upsert a ScoreEntry, then create the post with `kind: 'REVIEW'`, `targetUnitId`, `body`, `extra` containing `title`, and `scoreEntryId` linking to the upserted ScoreEntry.

#### Scenario: Successful review creation with score

- **WHEN** an authenticated user fills in title, body (200+ characters), and score (e.g. 8), then submits
- **THEN** the system SHALL first call `scoreApi.upsertScore({ unitId, value: 8 })`, receive a `scoreEntryId`, then call `postApi.createPost` with `kind: 'REVIEW'`, `targetUnitId: bookUnitId`, `body`, `extra: { title }`, and `scoreEntryId`
- **AND** redirect to the new review's detail page

#### Scenario: Score input uses RatingInput

- **WHEN** the review creation form is rendered
- **THEN** the score input SHALL be `<RatingInput>` from `@rezics/ui` configured with `max={SCORE_MAX}` and `precision={1}`

### Requirement: Inline remark form on review tab

The book detail review tab SHALL display an inline remark creation form below the score overview. The form SHALL contain a score input rendered per the `score-input-primitive` capability (rezics-owned `<RatingInput>` from `@rezics/ui`, `max = SCORE_MAX`, `precision = 1`, integer 1–10) and a text input field with a submit button. The form SHALL be available to authenticated users without requiring page navigation. There SHALL be no character limit on the remark body.

#### Scenario: Authenticated user sees remark form

- **WHEN** an authenticated user views the review tab of a book detail page
- **THEN** the inline remark creation form is visible with a `<RatingInput>` score input (integer 1–10), text input, and submit button

#### Scenario: Unauthenticated user cannot create remark

- **WHEN** an unauthenticated user views the review tab
- **THEN** the form SHALL render in a disabled state (or be replaced by a sign-in prompt) and SHALL NOT submit

#### Scenario: Score input is RatingInput

- **WHEN** the remark inline form renders
- **THEN** the score input SHALL be `<RatingInput>` from `@rezics/ui`
- **AND** no `ToggleButtonGroup`, numeric-button row, or custom widget SHALL appear as the score input

### Requirement: Review edit page uses RatingInput

The review edit page at `/review/:reviewId/edit` SHALL load the existing review data and populate the title, body, and score fields with the current values. The existing score SHALL be loaded via `scoreQueries.userScores(userId, bookUnitId)` to populate the score input. The score input SHALL be rendered per the `score-input-primitive` capability (rezics-owned `<RatingInput>` from `@rezics/ui`, `max = SCORE_MAX`, `precision = 1`). The system SHALL preserve all existing data fields not modified by the user. The same 200-character minimum enforcement SHALL apply to the body during editing.

#### Scenario: Existing data populated on edit

- **WHEN** a user navigates to the edit page for an existing review
- **THEN** the title field shows `extra.title`, the body field shows the current markdown body, and the score input shows the current score from the linked ScoreEntry rendered as `<RatingInput>` stars

#### Scenario: Score change on edit

- **WHEN** a user changes the score and submits
- **THEN** the system SHALL upsert the new ScoreEntry value and the post's `scoreEntryId` SHALL update accordingly

### Requirement: Remark edit dialog uses RatingInput

The remark edit dialog SHALL load the existing remark body and score and allow the user to update either. The score input SHALL be rendered per the `score-input-primitive` capability (rezics-owned `<RatingInput>` from `@rezics/ui`, `max = SCORE_MAX`, `precision = 1`). The score SHALL remain optional; clearing the selection SHALL emit `null` and (on submit) disassociate the ScoreEntry from the post per existing remark semantics.

#### Scenario: Score input is RatingInput in edit dialog

- **WHEN** the remark edit dialog opens for an existing remark with a score
- **THEN** the score input SHALL be `<RatingInput>` from `@rezics/ui` showing the current score value

#### Scenario: Clearing score emits null

- **WHEN** the user clicks the currently selected star in the remark edit dialog
- **THEN** the score input SHALL emit `null` to its parent
- **AND** on submit the system SHALL disassociate the ScoreEntry from the post

