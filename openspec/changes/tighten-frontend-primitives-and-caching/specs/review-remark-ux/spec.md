## MODIFIED Requirements

### Requirement: Review creation

The review creation page at `/review/new/:bookUnitId` SHALL allow an authenticated user to create a PostKind.REVIEW post. The form SHALL include a title field (stored in `extra.title`), a markdown body field with preview support, a score input rendered per the `score-input-primitive` capability (MUI `<Rating>`, `max = SCORE_MAX`, `precision = 1`, integer 1–10, persisted via `scoreApi.upsertScore()`), and a target book derived from the route parameter `bookUnitId`. When a score is provided, the system SHALL first upsert a ScoreEntry, then create the post with `kind: 'REVIEW'`, `targetUnitId`, `body`, `extra` containing `title`, and `scoreEntryId` linking to the upserted ScoreEntry.

#### Scenario: Successful review creation with score
- **WHEN** an authenticated user fills in title, body (200+ characters), and score (e.g. 8), then submits
- **THEN** the system upserts a ScoreEntry with `{ unitId: bookUnitId, realm: defaultRealmId, value: 8 }`, then creates a post with `kind: 'REVIEW'`, `targetUnitId` set to the book's unit ID, `body` set to the markdown content, `extra` containing `title`, and `scoreEntryId` pointing to the upserted ScoreEntry

#### Scenario: Score is optional
- **WHEN** a user submits a review without selecting a score
- **THEN** the review is created with no `scoreEntryId` (no ScoreEntry created)

#### Scenario: Markdown body with preview
- **WHEN** the user writes markdown in the body field
- **THEN** a preview mode SHALL render the markdown as formatted content

#### Scenario: Score input uses MUI Rating
- **WHEN** the review creation form is rendered
- **THEN** the score input SHALL be `<Rating>` from `@mui/material/Rating` configured with `max={SCORE_MAX}` and `precision={1}`

### Requirement: Review editing

The review edit page at `/review/:reviewId/edit` SHALL load the existing review data and populate the title, body, and score fields with the current values. The existing score SHALL be loaded via `scoreQueries.userScores(userId, bookUnitId)` to populate the score input. The score input SHALL be rendered per the `score-input-primitive` capability (MUI `<Rating>`, `max = SCORE_MAX`, `precision = 1`). The system SHALL preserve all existing data fields not modified by the user. The same 200-character minimum enforcement SHALL apply to the body during editing.

#### Scenario: Existing data populated on edit
- **WHEN** a user navigates to the edit page for an existing review
- **THEN** the title field shows `extra.title`, the body field shows the current markdown body, and the score input shows the current score from the linked ScoreEntry rendered as MUI `<Rating>` stars

#### Scenario: Score change on edit
- **WHEN** a user changes the score and submits
- **THEN** the system calls `useUpsertScoreMutation()` with the new value (upserting on the same `(userId, unitId, realm)` key), and the post's `scoreEntryId` remains unchanged

#### Scenario: Partial update preserves unmodified fields
- **WHEN** a user changes only the title and submits
- **THEN** the body and score remain unchanged

### Requirement: Remark inline creation form

The book detail review tab SHALL display an inline remark creation form below the score overview. The form SHALL contain a score input rendered per the `score-input-primitive` capability (MUI `<Rating>`, `max = SCORE_MAX`, `precision = 1`, integer 1–10) and a text input field with a submit button. The form SHALL be available to authenticated users without requiring page navigation. There SHALL be no character limit on the remark body.

#### Scenario: Authenticated user sees remark form
- **WHEN** an authenticated user views the review tab of a book detail page
- **THEN** the inline remark creation form is visible with a MUI `<Rating>` score input (integer 1–10), text input, and submit button

#### Scenario: Unauthenticated user cannot create remark
- **WHEN** an unauthenticated user views the review tab
- **THEN** the inline remark creation form is either hidden or replaced with a prompt to sign in

#### Scenario: Score input is MUI Rating
- **WHEN** the remark inline form renders
- **THEN** the score input SHALL be `<Rating>` from `@mui/material/Rating`
- **AND** no `ToggleButtonGroup`, numeric-button row, or custom widget SHALL appear as the score input

### Requirement: Remark edit dialog

The remark edit dialog SHALL load the existing remark body and score and allow the user to update either. The score input SHALL be rendered per the `score-input-primitive` capability (MUI `<Rating>`, `max = SCORE_MAX`, `precision = 1`). The score SHALL remain optional; clearing the selection SHALL emit `null` and (on submit) disassociate the ScoreEntry from the post per existing remark semantics.

#### Scenario: Score input is MUI Rating in edit dialog
- **WHEN** the remark edit dialog opens for an existing remark with a score
- **THEN** the score input SHALL be `<Rating>` from `@mui/material/Rating` showing the current score value

#### Scenario: Clearing score emits null
- **WHEN** the user clicks the currently selected star in the remark edit dialog
- **THEN** the local score state SHALL become `null`
- **AND** submitting SHALL behave as the "remark without score" path defined in the remark creation API contract

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
