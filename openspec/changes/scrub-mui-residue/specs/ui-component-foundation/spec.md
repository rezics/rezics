## MODIFIED Requirements

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

### Requirement: Custom primitives are added on demand, not preemptively

Custom primitives SHALL be authored only when a concrete consumer needs them. The project's existing custom primitives (e.g. `RatingInput`, `EmptyState`, `Spinner`, `TextLink`) were each authored to satisfy a specific in-tree consumer. Subsequent additions SHALL be governed by an OpenSpec change that establishes the consumer first and the primitive second.

#### Scenario: Speculative primitive PR

- **WHEN** a pull request adds a custom primitive (e.g. `Combobox`, `DatePicker`, `DataTable`) without an in-tree consumer importing it
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to land the consumer use case first or to defer the primitive to its own change proposal

## REMOVED Requirements

### Requirement: No `@mui/*` imports in source code

**Reason**: The `deprecate-mui` migration is complete; no `@mui/*` package is installed and no source file imports from one. The shadcn-or-custom selection policy (preserved as a MODIFIED requirement above) covers the same intent without naming a specific defunct library. The corresponding R8 convention check is also removed.

**Migration**: None at the codebase level — no source file imports from `@mui/*` today, so no edits are needed. The convention-enforcement spec drops R8 in the same change. Reintroducing MUI requires an OpenSpec change updating this spec.

### Requirement: No `@mui/*` declarations in package.json

**Reason**: No `package/*/package.json` declares an `@mui/*` package or `@material/material-color-utilities`. The shadcn-or-custom requirement (MODIFIED above) covers the broader principle without naming a specific defunct library. R8 — which enforced this requirement at check time — is removed.

**Migration**: None at the codebase level. The convention-enforcement spec drops R8 in the same change.
