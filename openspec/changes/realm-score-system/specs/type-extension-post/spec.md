## ADDED Requirements

### Requirement: Optional scoreEntryId FK on Post

The Post model SHALL have an optional `scoreEntryId` field (UUID) referencing a ScoreEntry. This FK SHALL use `onDelete: Restrict` to prevent accidental cascade deletion of reviews when a score is removed. Posts with `kindKey = "review"` MUST have a non-null `scoreEntryId`. Posts with other kind keys MAY have a null `scoreEntryId`.

#### Scenario: Review post has scoreEntryId set

- GIVEN a ScoreEntry "score-1" for user "user-1" on book "book-1"
- WHEN the user creates a Post with `kindKey = "review"` and `scoreEntryId = "score-1"`
- THEN the Post SHALL be created with `scoreEntryId = "score-1"`

#### Scenario: Review post without scoreEntryId is rejected

- WHEN a user attempts to create a Post with `kindKey = "review"` and `scoreEntryId = null`
- THEN the system SHALL reject the request with a validation error

#### Scenario: Discussion post without scoreEntryId is allowed

- WHEN a user creates a Post with `kindKey = "discussion"` and no `scoreEntryId`
- THEN the Post SHALL be created with `scoreEntryId = null`

#### Scenario: Restrict prevents cascade on score deletion

- GIVEN a Post "review-1" with `scoreEntryId = "score-1"`
- WHEN a non-admin attempts to delete ScoreEntry "score-1"
- THEN the database SHALL prevent the deletion due to the Restrict constraint
- AND the ScoreEntry SHALL remain intact

## MODIFIED Requirements

### Requirement: kindKey classifies post purpose

Every Post SHALL have a `kindKey` field that classifies its purpose. Valid values include `discussion`, `review`, `reply`, and `note`. The `kindKey` determines how the post is treated by the system: a Post with `kindKey = "review"` is a Review, a Post with a `parentPostUnitId` set is a Comment (typically with `kindKey = "reply"`). Posts with `kindKey = "review"` MUST have a non-null `scoreEntryId` referencing the user's score for the target unit. Posts with `kindKey = "note"` (remarks) MUST also have a non-null `scoreEntryId`.

#### Scenario: Create a review post

- GIVEN a user "user-1", a book "book-1", and an existing ScoreEntry "score-1" for the user on that book
- WHEN the user creates a Post with `kindKey = "review"`, `targetUnitId = "book-1"`, and `scoreEntryId = "score-1"`
- THEN the Post SHALL be classified as a review of "book-1" linked to the user's score

#### Scenario: Create a discussion post

- WHEN a user creates a Post with `kindKey = "discussion"` and `targetUnitId = "book-1"`
- THEN the Post SHALL be classified as a discussion about "book-1"
- AND `scoreEntryId` SHALL be null

#### Scenario: Create a reply (comment)

- GIVEN an existing Post "post-1"
- WHEN a user creates a Post with `kindKey = "reply"` and `parentPostUnitId = "post-1"`
- THEN the Post SHALL be treated as a comment on "post-1"
- AND `scoreEntryId` SHALL be null

#### Scenario: Create a note (remark) with score

- GIVEN a user "user-1", a book "book-1", and an existing ScoreEntry "score-1" for the user on that book
- WHEN the user creates a Post with `kindKey = "note"`, `targetUnitId = "book-1"`, and `scoreEntryId = "score-1"`
- THEN the Post SHALL be classified as a remark on "book-1" linked to the user's score
