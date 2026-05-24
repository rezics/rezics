## ADDED Requirements

### Requirement: ContentDoc text projection is indexed

The content index SHALL include a `contentText` field for indexable Units whose canonical content is stored as `ContentDoc`. Runtime v1 SHALL derive `contentText` during sync or full reindex from supported `content.main.source` Markdown only. `contentText` SHALL NOT be read from any PostgreSQL `contentText` column.

#### Scenario: Markdown main text is projected

- **WHEN** a published post or chapter has `content.main.type = "markdown"`
- **THEN** Meilisearch sync SHALL derive `contentText` from `content.main.source`
- **AND** the derived text SHALL include `content.main.source` verbatim

#### Scenario: PostgreSQL projection is not required

- **WHEN** a content document is indexed
- **THEN** the sync process SHALL derive text from canonical content JSON
- **AND** it SHALL NOT require a PostgreSQL `contentText` field

### Requirement: Slot-bearing content is not indexed in runtime v1

When a content document includes slots whose types contribute text (e.g. `infobox` row labels, infobox markdown values, `entity-list` titles), runtime v1 SHALL preserve those slots in stored JSON but SHALL NOT include slot text in `contentText`. New slot types added in the future MUST update the contract-level `extractText` helper, but wiring slot text into Meilisearch is deferred until structured slot support is implemented.

#### Scenario: Infobox text is searchable

- **GIVEN** a wiki post whose `content.slots.infobox` contains a row with label "Author" and a markdown value referencing a character
- **WHEN** the post is synced to Meilisearch
- **THEN** runtime v1 `contentText` SHALL NOT include the "Author" label or markdown value source solely from that slot

### Requirement: Description text projection is indexed

The content index SHALL include `descriptionText` for rich descriptions stored as `ContentDoc` (`User.description`, `UnitTranslation.description`, and any future rich-description field). Runtime v1 SHALL derive `descriptionText` during sync or full reindex from supported `description.main.source` Markdown only and SHALL NOT read from a PostgreSQL `descriptionText` column.

#### Scenario: Rich description is projected

- **WHEN** a Unit has a Markdown description content document
- **THEN** Meilisearch sync SHALL derive `descriptionText` from `description.main.source`

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
