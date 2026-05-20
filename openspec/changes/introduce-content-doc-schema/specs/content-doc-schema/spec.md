## ADDED Requirements

### Requirement: Versioned ContentDoc schema
The contract package SHALL define a `ContentDoc` schema for long-form editable content. A content document SHALL include `schema = "rezics.content"`, a numeric `version`, a required `main` block, an optional `slots` object, and an optional `layout` array.

#### Scenario: Markdown document validates
- **WHEN** a content document contains `schema = "rezics.content"`, `version = 1`, and `main = { type: "markdown", source: "Hello" }`
- **THEN** contract validation SHALL accept the document

#### Scenario: Unsupported document schema is rejected
- **WHEN** a content document uses an unknown `schema` value
- **THEN** contract validation SHALL reject the document or the renderer SHALL return an explicit unsupported-content fallback

### Requirement: Main block supports Markdown source
The first supported `ContentDoc.main` block type SHALL be `markdown`. A Markdown main block SHALL store source Markdown in `source`.

#### Scenario: Main Markdown source is canonical
- **WHEN** a wiki page is saved with Markdown text
- **THEN** the canonical PostgreSQL payload SHALL store that text at `content.main.source`
- **AND** no `Post.body` column or DTO field SHALL be required to recover the text

### Requirement: Slots are typed content blocks
`ContentDoc.slots` SHALL be an object keyed by stable slot ids. Every slot value SHALL include a `type` discriminator. Unknown slot types SHALL be preserved in stored content but SHALL render through an unsupported-slot fallback unless a renderer is registered.

#### Scenario: Unknown slot remains non-destructive
- **WHEN** a renderer reads a content document with an unknown slot type
- **THEN** it SHALL NOT discard that slot from the content payload
- **AND** it SHALL render a controlled unsupported-slot placeholder if the slot appears in layout

### Requirement: Unit reference slots store references only
Slots that refer to other Rezics Units SHALL store Unit references, not embedded Unit DTO snapshots. A Unit reference SHALL include at minimum `unitId` and MAY include `unitType` and a semantic `view` hint.

#### Scenario: Referenced Unit is hydrated separately
- **WHEN** a wiki content document contains a slot referencing a book Unit
- **THEN** the stored content document SHALL contain the referenced book's `unitId`
- **AND** the renderer or API client SHALL hydrate the book display data through a Unit read path rather than reading it from the slot payload

### Requirement: Content references are batch hydratable
Rendering code SHALL be able to scan a `ContentDoc` and produce a deduplicated list of referenced Unit ids grouped by type when type information is present. Rich content rendering SHALL use batch/list APIs for those references.

#### Scenario: Multiple slots reference Units
- **WHEN** a content document references three books and two entities across multiple slots
- **THEN** the hydration layer SHALL collect the five referenced Unit ids before rendering
- **AND** it SHALL avoid one network request per slot

### Requirement: Layout is semantic
`ContentDoc.layout` SHALL describe semantic placement of slots, such as main and aside regions. It SHALL NOT persist arbitrary CSS, pixel coordinates, or renderer-specific styling details.

#### Scenario: Aside slot placement
- **WHEN** a content document places `infobox` in an aside region
- **THEN** the layout entry SHALL identify the region and slot id
- **AND** visual styling SHALL be determined by the renderer and design system

### Requirement: Text projection is derived outside PostgreSQL
The system SHALL NOT store `contentText` or `descriptionText` as PostgreSQL canonical or cache columns for this change. Text projection for search SHALL be derived from `ContentDoc` during Meilisearch sync or full reindex.

#### Scenario: Content is indexed
- **WHEN** a post content document is synced to Meilisearch
- **THEN** the search document SHALL include derived `contentText`
- **AND** the source PostgreSQL row SHALL store only the canonical content JSON and typed product fields

### Requirement: ContentDoc is not product metadata
Values inside `ContentDoc` SHALL NOT become PostgreSQL product filtering, sorting, permission, pricing, rating, or canonical metadata surfaces. If a value must drive product behavior, it SHALL be promoted to a typed column or relation outside the content document.

#### Scenario: Infobox date becomes filterable
- **WHEN** a wiki infobox date needs to power a product search filter
- **THEN** the value SHALL be modeled as a typed field or relation
- **AND** it SHALL NOT be queried directly from `content.slots` in PostgreSQL
