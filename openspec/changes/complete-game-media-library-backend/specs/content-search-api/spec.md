## ADDED Requirements

### Requirement: Server applies game and media platform and rating filters

The content search API SHALL apply platform filters using Entity-backed
projected fields and age-rating filters using the existing tag filter over
external rating tags. The server SHALL NOT translate filter input from legacy
platform strings or `ageRatingKey` values in the request path.

#### Scenario: Search games by platform

- **WHEN** a client searches GAME content with `platformEntityIds = ["platform-ps5"]`
- **THEN** the server SHALL filter the search index by the projected platform Entity id
- **AND** matching results SHALL include GAME releases available on that platform

#### Scenario: Search by age rating

- **WHEN** a client searches content filtered by the `pegi-12` rating tag
- **THEN** the server SHALL filter the search index by the projected rating tag id through the existing tag filter
- **AND** matching GAME or MEDIA releases SHALL be returned according to the rest of the query

### Requirement: Server returns game and media metadata in search results

The content search API SHALL return enough typed metadata for GAME and MEDIA
cards to render without secondary per-card metadata queries. This SHALL include
available projected platform Entity ids, rating tag ids, media kind, release
date, and system-requirement summary fields when available.

#### Scenario: Game result includes platform summary

- **WHEN** a GAME release appears in search results
- **THEN** the result metadata SHALL include platform Entity ids or a platform summary when indexed
- **AND** the client SHALL not need to inspect legacy `GamePlatform` rows

#### Scenario: Media result includes media kind

- **WHEN** a MEDIA release appears in search results
- **THEN** the result metadata SHALL include its `kindKey`
- **AND** the client SHALL be able to distinguish movie, anime, TV series, and other media kinds
