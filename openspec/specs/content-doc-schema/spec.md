# content-doc-schema Specification

## Purpose

Defines the canonical `ContentDoc` JSON schema used for long-form editable content across rezics (post bodies, chapter content, user/unit descriptions). Establishes the versioned envelope, the `main` content block, the v1 slot family (`unit-ref`, `entity-list`, `infobox`), inline directive grammar for placing slots inside Markdown, semantic layout placement, the renderer trust model, and the contract-level helpers `scanRefs` and `extractText`. This change wires the schema and helpers into the contract layer and into storage/search projection; structured slot rendering and editing UI are deferred to a follow-up.

## Requirements

### Requirement: Versioned ContentDoc envelope

The contract package SHALL define a preferred `ContentDoc` schema for long-form editable content. A preferred content document SHALL include `schema = "rezics.content"`, a numeric `version`, a required `main` content block, an optional `slots` object, and an optional `layout` array. This schema is a producer/editor/consumer contract and helper shape, not a recursive server-side write validation requirement.

#### Scenario: Markdown document validates in contract helpers

- **WHEN** a content document contains `schema = "rezics.content"`, `version = 1`, and `main = { type: "markdown", source: "Hello" }`
- **THEN** contract-level validation helpers SHALL accept the document

#### Scenario: Unsupported document schema or version is preserved by the server

- **WHEN** a client submits a content document with an unknown `schema` value or a `version` that the server does not support
- **THEN** the server SHALL NOT reject the write solely for that reason
- **AND** readers SHALL preserve the stored value for tolerant rendering / extraction fallback

### Requirement: UnitRef is the universal cross-Unit reference primitive

The contract SHALL define `UnitRef = { unitId: string; unitType?: UnitType }`. Every cross-Unit reference inside `ContentDoc` (in slots, infobox row values, future block types) SHALL be expressed as a `UnitRef` and SHALL NOT embed Unit display data such as titles, covers, permissions, or visibility.

#### Scenario: Referenced Unit is hydrated separately

- **WHEN** a content document contains a slot referencing a book Unit
- **THEN** the stored slot SHALL contain a `UnitRef` with the book's `unitId`
- **AND** the renderer or API client SHALL hydrate the book display data through a Unit read path rather than reading it from the slot payload

### Requirement: ContentBlock is the renderable text primitive

The contract SHALL define `ContentBlock` as a discriminated union starting with `{ type: "markdown"; source: string }`. Any text-bearing position inside `ContentDoc` that supports formatting (e.g. `main`, `infobox.rows[].label`, `entity-list.title`) SHALL use `ContentBlock` instead of a bare string.

#### Scenario: Main is a ContentBlock

- **WHEN** a content document is saved with markdown text in `main`
- **THEN** `main` SHALL be stored as `{ type: "markdown", source: "<text>" }`
- **AND** future non-markdown block types MAY extend the union without changing field placement

### Requirement: Main block supports Markdown source

The first supported `ContentBlock` type SHALL be `markdown` with text in `source`. The canonical PostgreSQL payload for a post body SHALL store its text at `content.main.source`.

#### Scenario: Main Markdown source is canonical

- **WHEN** a wiki page is saved with Markdown text
- **THEN** the canonical PostgreSQL payload SHALL store that text at `content.main.source`
- **AND** no `Post.body` column or DTO field SHALL be required to recover the text

### Requirement: Slot family v1

`ContentDoc.slots` SHALL be an object keyed by stable slot ids. Each slot value SHALL include a `type` discriminator. The v1 slot family SHALL include at minimum the following types:

- `unit-ref` — a single `UnitRef` with optional `render` hint (`view`, `cardSize`).
- `entity-list` — an ordered `refs: UnitRef[]` with optional `title: ContentBlock` and optional `render` hint (`layout: "horizontal" | "vertical" | "grid" | "table"`, `cardSize`, `groupBy`).
- `infobox` — `rows: Array<{ label: ContentBlock; value: ContentBlock | UnitRef | UnitRef[] | { type: "date"; iso: string } | { type: "link"; url: string; label?: string } }>`.

Slot data fields (`ref`, `refs`, `rows`) SHALL be the source of truth. Slot `render` fields SHALL be display intent only and SHALL NOT carry data.

#### Scenario: Entity-list slot stores refs and render intent separately

- **WHEN** a wiki author saves a "main cast" slot with three character UnitRefs and a horizontal-card display preference
- **THEN** the slot SHALL store `{ type: "entity-list", refs: [...], render: { layout: "horizontal", cardSize: "compact" } }`
- **AND** the same `refs` SHALL be readable independently of the `render` field

#### Scenario: Infobox row value can be a structured non-text value

- **WHEN** a wiki infobox row stores a release date
- **THEN** the row value SHALL be `{ type: "date", iso: "2024-05-22" }` rather than a markdown string containing the date

### Requirement: Unknown slot types are preserved

Unknown slot `type` values SHALL be preserved verbatim on read and write. A renderer that does not recognize a slot type SHALL NOT discard it from the stored payload.

#### Scenario: Unknown slot survives a round-trip

- **WHEN** a content document with a slot of type `"future-experiment"` is read and rewritten without modification
- **THEN** the stored slot value SHALL be byte-equivalent to the original

### Requirement: Inline directive grammar inside main markdown

Slots MAY be referenced inline inside `content.main.source` using CommonMark directive syntax. The grammar SHALL be:

- Block: `:::slot{ id="<slotId>" [render-attr=value ...] }` ... `:::`
- Inline: `:slot[<slotId>]{ [render-attr=value ...] }`

Directive attributes inside the `main` source MAY override the slot's stored `render` intent. Directive bodies SHALL NOT contain slot data; slot data is always read from `content.slots[slotId]`.

#### Scenario: Block directive references a slot id

- **WHEN** `content.main.source` contains `:::slot{ id="character-list" }\n:::`
- **AND** `content.slots["character-list"]` exists
- **THEN** the directive is a valid inline placement of that slot

### Requirement: Slot placement is exclusive in preferred documents

For any `slotId` defined in a preferred `content.slots` document, the slot SHOULD appear in at most one of: (a) an inline directive inside `content.main.source`, (b) a `layout` entry. A slot MAY also appear in neither, in which case it is stored but not currently rendered. Editors and contract tests SHALL enforce this preferred shape; server write paths SHALL NOT recursively parse directives or reject stored content solely because placement is ambiguous.

#### Scenario: Slot in both inline directive and layout is flagged by contract helpers

- **WHEN** a client submits a content document where `slots.foo` is referenced by a `:slot[foo]` directive in `main` AND also listed in a `layout` entry
- **THEN** contract-level validation helpers SHALL report a preferred-shape violation
- **AND** server persistence SHALL remain opaque and SHALL NOT depend on directive parsing

### Requirement: Runtime v1 processes only main

The full `ContentDoc` schema SHALL be available from `@rezics/contract`, but this change's runtime services SHALL only interpret `content.main` / `description.main`. Server create/update paths SHALL persist the full submitted JSON value, including `slots`, `layout`, and unknown fields, without recursively validating or interpreting non-main fields.

#### Scenario: Full content JSON is persisted

- **WHEN** a client updates a post with a `ContentDoc` containing `main`, `slots`, and `layout`
- **THEN** the server SHALL persist the full JSON value
- **AND** it SHALL NOT reject, normalize, or delete `slots` or `layout` solely because runtime v1 does not support them

#### Scenario: Runtime only reads main

- **WHEN** a stored `ContentDoc` contains both `main.source` and slot text
- **THEN** rendering, search projection, authority checks, and history changed-field emission in this change SHALL use only `main`
- **AND** slot/layout content SHALL be ignored by those services until a follow-up change supports them

### Requirement: Layout is semantic

`ContentDoc.layout` SHALL describe semantic placement of slots not referenced inline. Each entry SHALL be `{ region: "main" | "aside" | "after-main" | "before-main"; slotId: SlotId }`. It SHALL NOT persist arbitrary CSS, pixel coordinates, breakpoints, or renderer-specific styling details.

#### Scenario: Aside slot placement

- **WHEN** a content document places `infobox` in an aside region
- **THEN** the layout entry SHALL identify `region: "aside"` and `slotId: "infobox"`
- **AND** visual styling SHALL be determined by the renderer and design system

### Requirement: Declarative reference scanning

The contract SHALL expose `scanRefs(doc: ContentDoc): UnitRef[]`. `scanRefs` SHALL walk the entire document, including all slot types in the v1 family and any nested `UnitRef`-shaped values inside infobox row values, and SHALL return a deduplicated list. When `unitType` is present on a ref, callers MAY group results by type. ContentDoc SHALL NOT carry a top-level manifest of references. This helper is contract-level in this change; runtime services SHALL NOT use it for hydration/search/history until structured slot rendering is supported.

#### Scenario: Multiple slots reference Units

- **WHEN** a content document references three books and two entities across multiple slots
- **THEN** `scanRefs(doc)` SHALL return five `UnitRef` entries with no duplicates
- **AND** rich content rendering SHALL use this output to drive batch hydration rather than per-slot fetches

#### Scenario: New slot types extend the scanner

- **WHEN** a new slot type adds a ref-bearing field
- **THEN** `scanRefs` SHALL be updated to walk that field
- **AND** consumers SHALL NOT need to add their own scanning logic

### Requirement: Centralized text extraction

The contract SHALL expose `extractText(doc: ContentDoc): string`. `extractText` SHALL include `main` markdown source verbatim and SHALL include text-bearing fields of every v1 slot type (e.g. `infobox.rows[].label.source`, infobox markdown values, `entity-list.title.source`). Every future slot type that carries human-readable text MUST contribute to `extractText`. This helper is contract-level in this change; runtime search projection SHALL index only supported `main` text until structured slot search is supported.

#### Scenario: Infobox text is included

- **WHEN** a content document has an infobox row with `label = { type: "markdown", source: "Author" }` and a markdown value
- **THEN** `extractText(doc)` SHALL include both the label source and the markdown value source

#### Scenario: Unit-ref slot contributes no text by itself

- **WHEN** a content document contains only a `unit-ref` slot with no inline title
- **THEN** `extractText(doc)` SHALL NOT invent display text for the reference
- **AND** referenced Unit display text SHALL be added at sync time by joining `scanRefs` results with hydrated Unit fields

### Requirement: Renderer trust model and Markdown fallback

Read paths SHALL NOT re-validate stored documents. Renderers that cannot interpret a value SHALL render it as Markdown rather than throw. The fallback sequence SHALL be:

1. If the stored value is a string, render it as Markdown.
2. Else if `content.main.source` is a non-empty string, render `content.main.source` as Markdown.
3. Else render `JSON.stringify(content)` as Markdown.

#### Scenario: Unknown schema renders as Markdown

- **WHEN** a renderer reads a stored document whose `schema` is unrecognized
- **THEN** the renderer SHALL NOT throw
- **AND** it SHALL render the document via the fallback sequence

#### Scenario: Raw string accidentally stored

- **WHEN** a stored content value is a bare string (e.g. due to a historical migration anomaly)
- **THEN** the renderer SHALL render the string as Markdown

#### Scenario: Unsupported version preserves content

- **WHEN** a renderer reads a document with a `version` it does not support but a recognizable `main.source`
- **THEN** the renderer SHALL render `main.source` as Markdown
- **AND** the stored document SHALL NOT be mutated

### Requirement: Text projection is derived outside PostgreSQL

The system SHALL NOT store `contentText` or `descriptionText` as PostgreSQL canonical or cache columns. Text projection for search SHALL be derived from supported `ContentDoc.main` Markdown during Meilisearch sync or full reindex in this change.

#### Scenario: Content is indexed

- **WHEN** a post content document is synced to Meilisearch
- **THEN** the search document SHALL include a `contentText` field derived from `content.main.source`
- **AND** the source PostgreSQL row SHALL store only the canonical content JSON and typed product fields

### Requirement: ContentDoc and extra have disjoint responsibilities

Values inside `ContentDoc` SHALL be renderable content (text, slots, layout, references). Non-rendered feature metadata SHALL live in `Post.extra` or the equivalent `extra` JSON of other models. Values inside `ContentDoc` SHALL NOT become PostgreSQL product filtering, sorting, permission, pricing, rating, or canonical metadata surfaces. If a value must drive product behavior, it SHALL be promoted to a typed column or relation outside the content document.

#### Scenario: Cover URL stays in extra, not ContentDoc

- **WHEN** a chapter cover URL is stored for display
- **THEN** the URL SHALL live in `UnitTranslation.extra.coverUrl`
- **AND** it SHALL NOT be embedded inside `content.slots`

#### Scenario: Infobox date becomes filterable

- **WHEN** a wiki infobox date needs to power a product search filter
- **THEN** the value SHALL be modeled as a typed field or relation
- **AND** it SHALL NOT be queried directly from `content.slots` in PostgreSQL
