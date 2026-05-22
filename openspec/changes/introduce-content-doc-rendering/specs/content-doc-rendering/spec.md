## ADDED Requirements

### Requirement: ContentDoc renderer entry point

TODO — define the single entry point through which post, chapter, wiki, and description surfaces render a `ContentDoc`. The entry point SHALL accept an opaque value (the renderer trust model from `content-doc-schema` applies) and SHALL parse, hydrate, and render via the slot registry.

#### Scenario: TODO

- **WHEN** TODO
- **THEN** TODO

### Requirement: Directive parser recognises slot references

TODO — block `:::slot{ id="<slotId>" }` ... `:::` and inline `:slot[<slotId>]{ ... }` SHALL be parsed during markdown rendering and replaced with the corresponding slot rendering output.

#### Scenario: TODO

- **WHEN** TODO
- **THEN** TODO

### Requirement: Slot renderer registry dispatches by type

TODO — the registry SHALL map slot `type` to a renderer component; unknown types SHALL render through a fallback component without throwing.

#### Scenario: TODO

- **WHEN** TODO
- **THEN** TODO

### Requirement: Hydration batches references through scanRefs

TODO — rendering surfaces SHALL call `scanRefs` and batch-fetch referenced Units before rendering slots that depend on hydrated display data.

#### Scenario: TODO

- **WHEN** TODO
- **THEN** TODO

### Requirement: Layout regions place non-inline slots

TODO — non-inline slots listed in `ContentDoc.layout` SHALL be rendered into their declared regions (`main` / `aside` / `before-main` / `after-main`).

#### Scenario: TODO

- **WHEN** TODO
- **THEN** TODO

### Requirement: Unsupported content falls back without crashing

TODO — the renderer SHALL implement the fallback sequence defined by `content-doc-schema` (raw string → markdown; `main.source` → markdown; `JSON.stringify(content)` → markdown) and SHALL surface a visible-but-graceful indicator.

#### Scenario: TODO

- **WHEN** TODO
- **THEN** TODO
