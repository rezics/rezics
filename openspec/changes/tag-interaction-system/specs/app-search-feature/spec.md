## MODIFIED Requirements

### Requirement: Search supports realm and tag filtering

The search feature SHALL support filtering by realm and by tags (both global and realm-scoped). Tag filtering SHALL use tag UUIDs, not tag name strings. The frontend SHALL pass tag UUIDs obtained from prior tag lookups, UI state, or **injected router state**. When `injectedTags` is present in router navigation state, the search page SHALL use the provided `unitId` values directly. When absent, the search page SHALL resolve tag slugs (parsed from the `[slug]` URL syntax) to `unitId` values via the tag API before issuing the search request.

#### Scenario: Search within a realm

- **GIVEN** the user is browsing a realm page
- **WHEN** they perform a search
- **THEN** the search request SHALL include `realmId` in the `ContentSearchOptions`
- **AND** results SHALL be scoped to that realm

#### Scenario: Search with tag filter from injected state

- **GIVEN** the user navigated from a book's tag interaction with `injectedTags: [{ slug: "isekai", unitId: "tag-1", name: "異世界" }]`
- **WHEN** the search page renders
- **THEN** a tag chip labeled "異世界" SHALL appear immediately
- **AND** the search request SHALL include `unitId: "tag-1"` in tag filters without a resolution round trip

#### Scenario: Search with tag filter from URL (no injection)

- **GIVEN** the user navigates directly to `/search?q=[isekai]` with no router state
- **WHEN** the search page renders
- **THEN** the search page SHALL resolve slug "isekai" to its `unitId` via API
- **AND** once resolved, the tag chip SHALL display the translated name and the search SHALL execute with the resolved `unitId`
