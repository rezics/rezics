## ADDED Requirements

### Requirement: ContentDoc text projection is indexed
The content index SHALL include a `contentText` field for indexable Units whose canonical content is stored as `ContentDoc`. `contentText` SHALL be derived during sync or full reindex and SHALL NOT be read from a PostgreSQL `contentText` column.

#### Scenario: Markdown main text is projected
- **WHEN** a published post or chapter has `content.main.type = "markdown"`
- **THEN** Meilisearch sync SHALL derive `contentText` from `content.main.source`

#### Scenario: PostgreSQL projection is not required
- **WHEN** a content document is indexed
- **THEN** the sync process SHALL derive text from canonical content JSON
- **AND** it SHALL NOT require a PostgreSQL `contentText` field

### Requirement: Description text projection is indexed
The content index SHALL include `descriptionText` for rich descriptions stored as `ContentDoc`. `descriptionText` SHALL be derived during sync or full reindex and SHALL NOT be read from a PostgreSQL `descriptionText` column.

#### Scenario: Rich description is projected
- **WHEN** a Unit has a Markdown description content document
- **THEN** Meilisearch sync SHALL derive `descriptionText` from the description document

## MODIFIED Requirements

### Requirement: Index searchable attributes are ordered by priority
The content index SHALL configure searchable attributes in priority order: `titles`, `subtitles`, `contentText`, `descriptionText`, `descriptions`, `summaries`, `creditNames`, `tagLabels`, and `subjectNames`.

#### Scenario: Title match ranks higher than description match
- **GIVEN** two documents: one with "magic" in `titles`, another with "magic" only in `descriptionText`
- **WHEN** searching for "magic"
- **THEN** the document with "magic" in `titles` SHALL rank higher

#### Scenario: Content text is searchable
- **GIVEN** a document with "dragon treaty" only in `contentText`
- **WHEN** searching for "dragon treaty"
- **THEN** the document SHALL be eligible to match through the content index
