# ui-component-foundation Specification

## Purpose

Defines the rezics frontend's UI component selection policy. The project uses **shadcn-or-custom**: shadcn primitives wrapped under `@rezics/ui/shadcn` are the default; rezics-owned custom primitives under `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local component directories cover the gaps. Third-party React component libraries are not introduced without an OpenSpec change updating this policy.

## Requirements
### Requirement: Component selection policy is shadcn-or-custom

The rezics frontend SHALL select UI components from exactly two sources:

1. **shadcn primitives** wrapped under `@rezics/ui/shadcn` (Radix-based, token-aligned via the `--rezics-*` CSS custom-property cascade) — the default choice when shadcn provides a primitive that fits the case.
2. **Custom rezics-owned primitives** under `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local primitive directories — the alternative when shadcn does not cover the case or when the rezics aesthetic requires a non-Radix-based implementation.

There SHALL NOT be a third source. Third-party React component libraries (Ant Design, Chakra UI, Mantine, or any equivalent) SHALL NOT be introduced as a UI primitive source. Adding a new third-party component library SHALL require an OpenSpec change that updates this requirement.

#### Scenario: Component author picks a primitive

- **WHEN** a developer (human or AI) needs a UI primitive (modal, dropdown, button, input, tabs, etc.) for any frontend file under `package/{ui,app,admin,folio,editor}/src/`
- **THEN** they SHALL pick from `@rezics/ui/shadcn` first
- **AND** if shadcn does not provide a fitting primitive, they SHALL pick or author a custom rezics primitive
- **AND** they SHALL NOT import from any third-party React component library

#### Scenario: New third-party UI library is rejected

- **WHEN** a pull request adds a third-party UI library to any `package/*/package.json`
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to either reuse a shadcn primitive or author a custom rezics primitive
- **AND** the only path to introducing a new UI library SHALL be an OpenSpec change updating this requirement

### Requirement: Custom primitives live in rezics-owned directories

Custom rezics primitives SHALL be authored under one of the following locations, in priority order:

1. `package/ui/src/primitive/<category>/<Component>.tsx` — single-purpose primitives intended for cross-package reuse.
2. `package/ui/src/composite/<category>/<Component>.tsx` — multi-primitive composites intended for cross-package reuse.
3. `package/<consumer>/src/<feature>/components/<Component>.tsx` — feature-local primitives that have not yet earned cross-package status.

Custom primitives SHALL NOT be added to `package/ui/src/shadcn/` (that directory is reserved for shadcn-original or shadcn-derived files) and SHALL NOT be added to `node_modules/` patches.

#### Scenario: New custom primitive placement

- **WHEN** a new custom primitive is added that wraps no shadcn primitive
- **THEN** it SHALL be placed under `package/ui/src/primitive/`, `package/ui/src/composite/`, or a feature-local components directory
- **AND** it SHALL NOT be placed under `package/ui/src/shadcn/`

### Requirement: Custom primitives are added on demand, not preemptively

Custom primitives SHALL be authored only when a concrete consumer needs them. The project's existing custom primitives (e.g. `RatingInput`, `EmptyState`, `Spinner`, `TextLink`) were each authored to satisfy a specific in-tree consumer. Subsequent additions SHALL be governed by an OpenSpec change that establishes the consumer first and the primitive second.

#### Scenario: Speculative primitive PR

- **WHEN** a pull request adds a custom primitive (e.g. `Combobox`, `DatePicker`, `DataTable`) without an in-tree consumer importing it
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to land the consumer use case first or to defer the primitive to its own change proposal

### Requirement: shadcn primitive surface is the @rezics/ui/shadcn export

The shadcn primitives consumed by the project SHALL be the ones exported from `@rezics/ui/shadcn`. Direct imports from `node_modules/shadcn-ui` (or equivalent installation paths) SHALL NOT appear in source files. The `@rezics/ui/shadcn` index re-exports the rezics-aligned versions, ensuring all consumers receive the same token-aligned defaults.

#### Scenario: Source file imports shadcn primitive

- **WHEN** a source file imports a shadcn primitive
- **THEN** the import path SHALL be `@rezics/ui/shadcn` (or a subpath thereof, e.g. `@rezics/ui/shadcn/dialog` if the build supports subpath imports)
- **AND** the import SHALL NOT bypass the rezics-ui re-export
