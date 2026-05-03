## MODIFIED Requirements

### Requirement: Review creation page

The review creation page at `/review/new/:bookUnitId` SHALL allow an authenticated user to create a PostKind.REVIEW post. The form SHALL include a title field (stored in `extra.title`), a markdown body field with preview support, a score input rendered per the `score-input-primitive` capability (rezics-owned `<RatingInput>` from `@rezics/ui`, `max = SCORE_MAX`, `precision = 1`, integer 1–10, persisted via `scoreApi.upsertScore()`), and a target book derived from the route parameter `bookUnitId`. When a score is provided, the system SHALL first upsert a ScoreEntry, then create the post with `kind: 'REVIEW'`, `targetUnitId`, `body`, `extra` containing `title`, and `scoreEntryId` linking to the upserted ScoreEntry.

#### Scenario: Successful review creation with score

- **WHEN** an authenticated user fills in title, body (200+ characters), and score (e.g. 8), then submits
- **THEN** the system SHALL first call `scoreApi.upsertScore({ unitId, value: 8 })`, receive a `scoreEntryId`, then call `postApi.createPost` with `kind: 'REVIEW'`, `targetUnitId: bookUnitId`, `body`, `extra: { title }`, and `scoreEntryId`
- **AND** redirect to the new review's detail page

#### Scenario: Score input uses RatingInput

- **WHEN** the review creation form is rendered
- **THEN** the score input SHALL be `<RatingInput>` from `@rezics/ui` configured with `max={SCORE_MAX}` and `precision={1}`
- **AND** there SHALL be no import of `@mui/material/Rating` in the form module

### Requirement: Review editing

The review edit page at `/review/:reviewId/edit` SHALL load the existing review data and populate the title, body, and score fields with the current values. The existing score SHALL be loaded via `scoreQueries.userScores(userId, bookUnitId)` to populate the score input. The score input SHALL be rendered per the `score-input-primitive` capability (rezics-owned `<RatingInput>` from `@rezics/ui`, `max = SCORE_MAX`, `precision = 1`). The system SHALL preserve all existing data fields not modified by the user. The same 200-character minimum enforcement SHALL apply to the body during editing.

#### Scenario: Existing data populated on edit

- **WHEN** a user navigates to the edit page for an existing review
- **THEN** the title field shows `extra.title`, the body field shows the current markdown body, and the score input shows the current score from the linked ScoreEntry rendered as `<RatingInput>` stars

#### Scenario: Score change on edit

- **WHEN** a user changes the score and submits
- **THEN** the system SHALL upsert the new ScoreEntry value and the post's `scoreEntryId` SHALL update accordingly

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
- **AND** no `ToggleButtonGroup`, numeric-button row, MUI `<Rating>`, or custom widget SHALL appear as the score input

### Requirement: Remark edit dialog

The remark edit dialog SHALL load the existing remark body and score and allow the user to update either. The score input SHALL be rendered per the `score-input-primitive` capability (rezics-owned `<RatingInput>` from `@rezics/ui`, `max = SCORE_MAX`, `precision = 1`). The score SHALL remain optional; clearing the selection SHALL emit `null` and (on submit) disassociate the ScoreEntry from the post per existing remark semantics.

#### Scenario: Score input is RatingInput in edit dialog

- **WHEN** the remark edit dialog opens for an existing remark with a score
- **THEN** the score input SHALL be `<RatingInput>` from `@rezics/ui` showing the current score value

#### Scenario: Clearing score emits null

- **WHEN** the user clicks the currently selected star in the remark edit dialog
- **THEN** the score input SHALL emit `null` to its parent
- **AND** on submit the system SHALL disassociate the ScoreEntry from the post
