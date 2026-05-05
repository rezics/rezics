# ui-component-foundation Specification

## Purpose

Defines the rezics frontend's UI component selection policy. The project uses **shadcn-or-custom**: shadcn primitives wrapped under `@rezics/ui/shadcn` are the default; rezics-owned custom primitives under `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local component directories cover the gaps. Third-party React component libraries are not introduced without an OpenSpec change updating this policy.

## Requirements
### Requirement: Component selection policy is shadcn-or-custom

The rezics frontend SHALL select UI components from exactly two sources:

1. **shadcn primitives** wrapped under `@rezics/ui/shadcn` (**base-ui-based**, vendored from the `base-luma` registry, token-aligned via the flat `--colors-*` CSS custom-property cascade emitted by UnoCSS preset-wind4 from `package/ui/src/config/uno-config.ts`) — the default choice when shadcn provides a primitive that fits the case.
2. **Custom rezics-owned primitives** under `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local primitive directories — the alternative when shadcn does not cover the case or when the rezics aesthetic requires a non-base-ui-based implementation.

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

### Requirement: Vendored shadcn primitives are unmodified (Path P)

Vendored shadcn primitives in `package/ui/src/shadcn/*.tsx` SHALL be sourced from the `base-luma` registry **as shipped**. There SHALL NOT be rezics-side edits to:

- Spacing values (padding, gap, min-height) inside vendored source.
- Color token references (vendored primitives consume the values shadcn ships with; the rezics `--colors-*` cascade resolves through the same custom-property names shadcn uses).
- Animation curves, durations, or easing.
- Behavior, prop signatures, or ARIA wiring.

The rezics design vocabulary (the closed nine-token `--padding-*` set defined in `complete-rezics-design-storybook/specs/design-system-density/spec.md`) applies to **rezics-authored** code only — `package/ui/src/primitive/`, `package/ui/src/composite/`, and app-level composites under `package/{admin,app,folio,editor}/src/`. Patching vendored shadcn primitives to consume rezics tokens SHALL NOT happen.

The exception list is explicit and finite: **`carousel.tsx`** and **`sidebar.tsx`** are documented Path-P exceptions, retaining their local customizations. Both files SHALL carry a top-of-file comment naming this Requirement and instructing readers not to run the shadcn CLI against them. Adding a third primitive to the exception list SHALL require an OpenSpec change updating this Requirement.

#### Scenario: Re-running the shadcn CLI on a non-exception primitive

- **WHEN** `bunx shadcn@latest add <primitive>` is run for any primitive in `package/ui/src/shadcn/` other than `carousel` or `sidebar`
- **THEN** the resulting source SHALL match the `base-luma` registry output byte-for-byte (modulo timestamp/header-comment differences shadcn writes)
- **AND** there SHALL be no manually-edited diff between the CLI output and the committed file

#### Scenario: Path-P boundary is enforced at review

- **WHEN** a pull request edits `package/ui/src/shadcn/<primitive>.tsx` (where primitive is not `carousel` or `sidebar`) to consume a rezics token (`var(--padding-*)`, `var(--colors-*)` rezics-specific names, etc.)
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to either: (a) recalibrate the rezics token's value in `uno-config.ts` so the rezics-authored composite next door lands at the right rhythm; or (b) author a rezics-authored alternative primitive that lives in `package/ui/src/primitive/` or `package/ui/src/composite/`.

#### Scenario: Path-P exception primitives carry a comment

- **WHEN** `package/ui/src/shadcn/carousel.tsx` or `package/ui/src/shadcn/sidebar.tsx` is opened
- **THEN** the file SHALL contain a top-of-file comment naming the Path-P exception status and pointing to `openspec/changes/migrate-shadcn-to-base-ui-luma/design.md` Decision 2

### Requirement: shadcn primitive base is `@base-ui/react`

The shadcn primitives under `@rezics/ui/shadcn` SHALL use `@base-ui/react` (≥1.4.1) as their headless primitive base, not `radix-ui`.

`radix-ui` SHALL NOT appear as a direct dependency of any package under `package/*/package.json`. (Transitive Radix dependencies brought in by third-party packages we don't own — e.g. `cmdk` — are out of scope of this Requirement; their resolution is governed by the third-party package's own roadmap.)

The `@rezics/ui/shadcn` index re-export surface is unchanged by this Requirement: consumers continue to import via `@rezics/ui/shadcn/<primitive>` and SHALL NOT see a path or name change.

#### Scenario: Direct radix-ui import is rejected

- **WHEN** any file under `package/{ui,admin,app,folio,editor}/src/` imports from `radix-ui`
- **THEN** the build SHALL fail
- **AND** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to use the equivalent `@base-ui/react` primitive

#### Scenario: Direct base-ui import is allowed inside vendored shadcn

- **WHEN** a file under `package/ui/src/shadcn/` imports from `@base-ui/react`
- **THEN** the import SHALL be allowed (vendored shadcn is the legitimate consumer)
