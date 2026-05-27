## ADDED Requirements

### Requirement: Game system requirements are stored as dedicated records

The system SHALL store game system requirements in dedicated records associated
with a GAME release Unit. Requirements SHALL NOT be stored in
`UnitTranslation.extra` or as opaque `Game.extra` payloads.

Each requirement row SHALL identify the game release Unit, requirement `tier`,
optional platform Entity, optional language, optional source external reference,
structured requirement JSON, optional raw source text, and timestamps.

#### Scenario: Store minimum Windows requirements

- **WHEN** a GAME release has minimum Windows requirements from a source
- **THEN** the system SHALL persist a requirement row with `tier = "minimum"`
- **AND** the row SHALL reference the Windows platform Entity when known
- **AND** the row SHALL preserve structured hardware values separately from raw text

#### Scenario: Requirements do not use UnitTranslation extra

- **WHEN** a game requirement includes raw human-readable text
- **THEN** the text SHALL be stored on the requirement row
- **AND** `UnitTranslation.extra` SHALL remain reserved for translation-correlated presentation metadata

### Requirement: Structured requirements use language-neutral hardware slugs

The contract SHALL define structured system requirement JSON whose hardware
component references MAY include language-neutral slugs such as
`cpu:intel-core-i5-8400` or `gpu:nvidia-gtx-1060-6gb`. Structured fields MAY
also preserve source text for components that cannot be confidently normalized.

The schema SHALL support at minimum CPU, GPU, memory, VRAM, storage, OS,
graphics API, and notes fields. The system SHALL allow partial structured data
because external sources are often incomplete.

#### Scenario: Store normalized CPU and GPU slugs

- **WHEN** a source requirement identifies an Intel Core i5-8400 and GTX 1060
- **THEN** the structured JSON MAY store `cpu.slug = "cpu:intel-core-i5-8400"`
- **AND** it MAY store `gpu.slug = "gpu:nvidia-gtx-1060-6gb"`
- **AND** it SHALL NOT require localized hardware names to drive filtering

#### Scenario: Preserve unparsed source component text

- **WHEN** a requirement component cannot be mapped to a known hardware slug
- **THEN** the structured JSON SHALL allow a text value for that component
- **AND** the raw source text SHALL remain available on the requirement row when provided

### Requirement: Requirement raw text is source-specific and language-scoped

Raw requirement text SHALL be scoped to the requirement source, platform, tier,
and optional language. The system SHALL NOT apply UnitTranslation fallback rules
to system requirement text.

#### Scenario: Same tier has two raw languages

- **WHEN** the same source provides English and Japanese recommended requirements
- **THEN** the system SHALL store separate requirement rows or language-scoped records
- **AND** clients SHALL request or select the desired language explicitly
- **AND** missing language fallback SHALL NOT be inferred from UnitTranslation

### Requirement: Requirement reads expose source evidence

Requirement DTOs SHALL expose enough source context for admin and import
surfaces to determine where the requirement came from. When a requirement was
imported from an external source, the DTO SHALL include the linked source
external reference id or equivalent source evidence field.

#### Scenario: Imported Steam requirement exposes source ref

- **WHEN** a requirement row is imported from a Steam external reference
- **THEN** the requirement DTO SHALL expose the source reference id
- **AND** admin surfaces SHALL be able to trace the row back to the source record
