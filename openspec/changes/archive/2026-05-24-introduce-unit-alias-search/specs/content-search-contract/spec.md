## ADDED Requirements

### Requirement: Alias matches behave as ordinary search text matches
Content search SHALL allow alias-derived fields to match free-text keyword queries. A match through a pinned alias SHALL NOT receive special ranking treatment solely because the alias is pinned.

#### Scenario: Keyword matches alias field
- **GIVEN** a content document has alias-derived searchable value `"3 Body Problem"`
- **WHEN** a user searches keyword `"3 Body"`
- **THEN** the document SHALL be eligible to appear in content search results

#### Scenario: Pinned alias does not force top ranking
- **GIVEN** two documents match a search query
- **AND** one match is through a pinned alias
- **WHEN** the search endpoint returns relevance-ranked results
- **THEN** the pinned alias SHALL NOT force its document ahead of other results solely because the alias is pinned
