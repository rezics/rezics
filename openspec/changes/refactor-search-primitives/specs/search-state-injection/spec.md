## MODIFIED Requirements

### Requirement: Search page accepts pre-resolved tag data via router state

The search page SHALL check for `injectedTags` in TanStack Router's navigation state on mount. If `injectedTags` is present and is an array of `{ slug: string, unitId: string, name: string }` objects, the search page SHALL feed those objects into `useSearchQuery({ initial: { tags: injectedTags } })` — without issuing any API call to resolve tag slugs. Rendering those tags in the UI is the responsibility of whichever composer / primitive consumes `initial.tags` (typically `TagPicker` in advanced mode, `AppliedFilterChips` in basic mode).

The search page SHALL NOT maintain a separate `<SelectedTagChips>` rendering path — `initial.tags` flows through the unified injection model exactly like any other filter value.

#### Scenario: Navigation with injected tags seeds useSearchQuery

- **GIVEN** a user navigates to `/search?q=[isekai][adventure]` with router state `{ injectedTags: [{ slug: "isekai", unitId: "tag-1", name: "異世界" }, { slug: "adventure", unitId: "tag-2", name: "冒險" }] }`
- **WHEN** the search page mounts
- **THEN** the page SHALL pass those tag objects to `useSearchQuery` as `initial.tags`
- **AND** no tag resolution API call SHALL be made
- **AND** the composer rendered by the page SHALL display the two tags — either as chips in `AppliedFilterChips` (basic mode) or as `TagPicker` chips (advanced mode)

## ADDED Requirements

### Requirement: Zone filters are injected as implicitInitial

Pre-applied zone filters (e.g., `zone.filters.type`, `zone.filters.tags`) SHALL be passed to `useSearchQuery` as `implicitInitial`, not `initial`. This causes them to be hidden from basic mode composers while remaining part of the effective search query and visible / editable in advanced mode.

#### Scenario: Zone filter hidden in basic mode

- **GIVEN** a zone with `filters = { type: ["BOOK"], tags: [{ slug: "light-novel" }] }`
- **WHEN** the user navigates to `/zone/light-novel/search` and the page renders in basic mode
- **THEN** the search request SHALL include `type: ["BOOK"]` and `tags: [{ slug: "light-novel" }]`
- **AND** neither SHALL appear as a chip in `AppliedFilterChips`
- **AND** neither SHALL appear as a primitive value in the rendered composer

#### Scenario: Zone filter visible and editable in advanced mode

- **GIVEN** the same zone as above
- **WHEN** the user switches to advanced mode
- **THEN** `ContentTypeCheckboxes` SHALL show BOOK as checked
- **AND** `TagPicker` SHALL display a chip for `light-novel`
- **AND** both SHALL be editable; unchecking / removing them SHALL narrow the implicit layer of the query
