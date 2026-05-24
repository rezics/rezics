# api-cache-coherence Specification

## Purpose

Defines mutation cache synchronization rules for the current TanStack Query-based API client so that successful writes are reflected in every visible domain detail cache before local draft state is cleared. The capability targets the legacy cache-coherence gap where Book editing saved successfully on the server but showed stale data until a hard refresh, and it constrains behavior so domain detail caches embedding `UnitTranslation` data, adjacent mutation results, in-flight stale detail responses, and direct Unit translation callers all converge on the freshest authoritative data. This capability covers fixes available today without TanStack DB or a Unit Store migration: targeted cache patching, query cancellation, and invalidation against authoritative mutation responses.

## Requirements

### Requirement: Domain detail caches reflect Unit translation mutations

The API client SHALL patch or invalidate every active domain detail cache that
embeds a `UnitTranslation` changed by a successful client mutation and is known
to the caller. Updating only `unitKeys.detail(unitId)` is insufficient when the
visible read model uses a domain cache such as `bookKeys.detail(unitId)` or
`realmKeys.detail(unitId)`.

#### Scenario: Book translation update patches Book detail

- **GIVEN** `bookKeys.detail("book-1")` is cached with a translation
  `{ language: "zh-hant", title: "Old" }`
- **WHEN** the Book edit page successfully upserts the `"zh-hant"` translation
  and the server returns `{ language: "zh-hant", title: "New" }`
- **THEN** the cached `bookKeys.detail("book-1").translations` SHALL contain
  `{ language: "zh-hant", title: "New" }`
- **AND** the old `"zh-hant"` translation SHALL NOT remain visible until a hard
  refresh

#### Scenario: New translation is appended

- **GIVEN** `bookKeys.detail("book-1")` is cached without a `"ja"` translation
- **WHEN** the `"ja"` translation is successfully created
- **THEN** the cached Book detail SHALL include the returned `"ja"` translation

#### Scenario: Deleted translation is removed

- **GIVEN** `bookKeys.detail("book-1")` is cached with an `"en"` translation
- **WHEN** the `"en"` translation is successfully deleted
- **THEN** the cached Book detail SHALL no longer include the `"en"` translation

### Requirement: Editor draft clearing must not reveal stale server cache

An editor that clears local draft state after a successful save SHALL ensure the
server-state cache it falls back to has been updated or invalidated for the saved
fields. The UI SHALL NOT show pre-save field values after a successful save
solely because local draft state was cleared before the relevant domain cache was
synchronized.

#### Scenario: Book edit save keeps saved values visible

- **GIVEN** the Book edit page loaded `bookKeys.detail("book-1")` with title
  `"Old"`
- **AND** the user changes the title draft to `"New"`
- **WHEN** the save succeeds
- **THEN** the page SHALL continue displaying `"New"` after local draft state is
  cleared
- **AND** no hard browser refresh SHALL be required to see `"New"`

### Requirement: Adjacent mutation results must preserve fresher embedded data

The API client SHALL preserve fresher embedded data when multiple successful
mutations in one user action update the same domain detail cache. A full DTO
response from one mutation SHALL NOT overwrite fresher embedded data already
synchronized from another mutation in the same action.

#### Scenario: Book metadata response does not overwrite translation update

- **GIVEN** a Book edit submit changes both metadata and the current translation
- **AND** the translation mutation has synchronized title `"New"` into
  `bookKeys.detail("book-1")`
- **WHEN** the metadata mutation returns a full `BookDTO` whose embedded
  translation still says `"Old"`
- **THEN** the final cached `bookKeys.detail("book-1")` SHALL preserve title
  `"New"`
- **AND** the metadata fields from the metadata response SHALL still be applied

### Requirement: In-flight stale detail responses are cancelled before cache writes

The API client SHALL protect authoritative mutation cache writes from in-flight
stale detail responses. Before a mutation writes authoritative data into an exact
domain detail cache, it SHOULD cancel in-flight queries for that exact detail key
when TanStack Query cancellation is available.

#### Scenario: Stale in-flight Book detail does not overwrite save

- **GIVEN** a `bookKeys.detail("book-1")` refetch started before a translation
  save completed
- **WHEN** the translation save succeeds and patches title `"New"` into the Book
  detail cache
- **THEN** the older in-flight response SHALL NOT overwrite the cache back to
  title `"Old"`

### Requirement: Direct Unit translation callers synchronize visible caches

Application code SHALL explicitly synchronize visible query caches when it
directly calls `unitApi.upsertTranslation` or `unitApi.deleteTranslation`. If the
caller cannot identify a domain detail cache, it SHALL at minimum invalidate the
exact `unitKeys.detail(unitId)` and refetch the local view it controls.

#### Scenario: Realm translation save invalidates Realm detail

- **WHEN** the Realm management page saves a Realm translation through the Unit
  translation API
- **THEN** `realmKeys.detail(realmId)` SHALL be patched or invalidated before
  navigation relies on the updated Realm data

#### Scenario: Pinboard translation save refreshes edited item display

- **WHEN** the Pinboard admin edits a pinned Unit's translation
- **THEN** the pinboard view SHALL refetch or patch the edited item
- **AND** any known exact domain detail cache for that Unit SHALL be invalidated
  or patched
