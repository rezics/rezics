## ADDED Requirements

### Requirement: Search page accepts pre-resolved tag data via router state

The search page SHALL check for `injectedTags` in TanStack Router's navigation state on mount. If `injectedTags` is present and is an array of `{ slug: string, unitId: string, name: string }` objects, the search page SHALL use these objects directly to render tag filter chips and to populate search query parameters — without issuing any API call to resolve tag slugs.

#### Scenario: Navigation with injected tags

- **GIVEN** a user navigates to `/search?q=[isekai][adventure]` with router state `{ injectedTags: [{ slug: "isekai", unitId: "tag-1", name: "異世界" }, { slug: "adventure", unitId: "tag-2", name: "冒險" }] }`
- **WHEN** the search page mounts
- **THEN** two tag filter chips SHALL render immediately with labels "異世界" and "冒險"
- **AND** the search query SHALL include `unitId` values for tag filtering
- **AND** no tag resolution API call SHALL be made

### Requirement: Search page falls back to slug resolution when no injection is present

When `injectedTags` is absent from router state (e.g., direct URL navigation, shared link, browser refresh), the search page SHALL parse `[slug]` tokens from the URL `q` parameter and resolve them to full tag objects via the existing API. This is the fallback path — functionally identical to the injected path, but with an additional API round trip.

#### Scenario: Direct URL navigation without injection

- **GIVEN** a user navigates directly to `/search?q=[isekai][adventure]` (no router state)
- **WHEN** the search page mounts
- **THEN** the search page SHALL parse slugs `["isekai", "adventure"]` from the URL
- **AND** the search page SHALL issue API calls to resolve these slugs to tag objects
- **AND** tag filter chips SHALL render once resolution completes

#### Scenario: Browser refresh clears injection

- **GIVEN** the user originally navigated with injected tags
- **WHEN** the user refreshes the browser
- **THEN** router state SHALL be empty
- **AND** the search page SHALL fall back to slug-based resolution

### Requirement: Injected and resolved tag data produce identical search behavior

Regardless of whether tags were injected or resolved, the search results, filter chips, and URL state SHALL be identical. The injection mechanism is a performance optimization only — it SHALL NOT change the functional behavior of the search page.

#### Scenario: Same results from both paths

- **GIVEN** tag "isekai" has slug "isekai" and unitId "tag-1"
- **WHEN** path A uses injected `{ slug: "isekai", unitId: "tag-1", name: "異世界" }` and path B resolves "isekai" from URL to the same unitId
- **THEN** both paths SHALL produce identical search API calls and identical results
