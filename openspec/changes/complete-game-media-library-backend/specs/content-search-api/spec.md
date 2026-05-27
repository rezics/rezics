## ADDED Requirements

### Requirement: Server applies game and media Entity-backed filters

The content search API SHALL apply platform and age-rating filters using
Entity-backed projected fields. The server SHALL NOT translate filter input
from legacy platform strings or age-rating keys in the request path.

#### Scenario: Search games by platform

- **WHEN** a client searches GAME content with `platformEntityIds = ["platform-ps5"]`
- **THEN** the server SHALL filter the search index by the projected platform Entity id
- **AND** matching results SHALL include GAME releases available on that platform

#### Scenario: Search by age rating

- **WHEN** a client searches content with `ageRatingEntityIds = ["rating-esrb-t"]`
- **THEN** the server SHALL filter the search index by projected age-rating Entity ids
- **AND** matching GAME or MEDIA releases SHALL be returned according to the rest of the query

### Requirement: Server returns game and media metadata in search results

The content search API SHALL return enough typed metadata for GAME and MEDIA
cards to render without secondary per-card metadata queries. This SHALL include
available projected platform ids, age-rating ids, media kind, release date, and
system-requirement summary fields when available.

#### Scenario: Game result includes platform summary

- **WHEN** a GAME release appears in search results
- **THEN** the result metadata SHALL include platform Entity ids or a platform summary when indexed
- **AND** the client SHALL not need to inspect legacy `GamePlatform` rows

#### Scenario: Media result includes media kind

- **WHEN** a MEDIA release appears in search results
- **THEN** the result metadata SHALL include its `kindKey`
- **AND** the client SHALL be able to distinguish movie, anime, TV series, and other media kinds
