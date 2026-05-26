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

### Requirement: shadcn primitive manual changes are documented

Vendored shadcn primitives in `package/ui/src/shadcn/*.tsx` SHALL be sourced
from the `base-luma` registry as shipped unless the primitive appears in the
documented exception registry below.

Non-exception shadcn primitives SHALL NOT receive rezics-side edits to:

- Spacing values (padding, gap, min-height) inside vendored source.
- Color token references (vendored primitives consume the values shadcn ships
  with; the rezics `--colors-*` cascade resolves through the same custom-property
  names shadcn uses).
- Animation curves, durations, or easing.
- Behavior, prop signatures, or ARIA wiring.

The rezics design vocabulary (the closed nine-token `--padding-*` set defined in
`complete-rezics-design-storybook/specs/design-system-density/spec.md`) applies
to **rezics-authored** code only — `package/ui/src/primitive/`,
`package/ui/src/composite/`, and app-level composites under
`package/{admin,app,folio,editor}/src/`. Patching a non-exception vendored
shadcn primitive to consume rezics tokens SHALL NOT happen.

The exception registry is the canonical list of shadcn primitives with permitted
manual changes. Any new manual edit to a shadcn primitive SHALL either:

1. fit inside the primitive's existing exception entry; or
2. update this registry in the same change that introduces the edit.

| File | Allowed manual changes | Required companion docs |
| --- | --- | --- |
| `package/ui/src/shadcn/card.tsx` | Rezics `surface="plain" \| "contained" \| "elevated"` API; `interactive` API for cursor/hover/focus treatment; `elevation={1..10}` API for elevated card calibration; `size` API; root `@container/card` query context; `CardMedia` slot; first/last media flush behavior; depth policy for card surfaces. | `package/ui/src/docs/pattern/card-surfaces.mdx`, `package/ui/src/docs/patterns.mdx`, and elevation/depth docs when shadow policy changes. |
| `package/ui/src/shadcn/carousel.tsx` | Existing local carousel controls and Embla integration retained from the Path-P exception. | `openspec/changes/migrate-shadcn-to-base-ui-luma/design.md` Decision 2. |
| `package/ui/src/shadcn/sidebar.tsx` | Existing local sidebar behavior, responsive state, and layout retained from the Path-P exception. | `openspec/changes/migrate-shadcn-to-base-ui-luma/design.md` Decision 2. |

#### Scenario: Re-running the shadcn CLI on a non-exception primitive

- **WHEN** `bunx shadcn@latest add <primitive>` is run for any primitive in `package/ui/src/shadcn/` that is not listed in the exception registry
- **THEN** the resulting source SHALL match the `base-luma` registry output byte-for-byte (modulo timestamp/header-comment differences shadcn writes)
- **AND** there SHALL be no manually-edited diff between the CLI output and the committed file

#### Scenario: Manual shadcn primitive edits are reviewed against the registry

- **WHEN** a pull request edits `package/ui/src/shadcn/<primitive>.tsx`
- **THEN** code review SHALL verify that the primitive is listed in the exception registry
- **AND** the edit SHALL fit the allowed manual changes for that primitive
- **AND** if the edit is a new kind of manual change, the pull request SHALL update the registry in this Requirement

#### Scenario: Non-exception primitive edits are rejected

- **WHEN** a pull request edits a shadcn primitive that is not listed in the exception registry
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to either: (a) recalibrate the token value in `uno-config.ts` so the unmodified primitive resolves correctly; (b) author a rezics-owned primitive under `package/ui/src/primitive/` or `package/ui/src/composite/`; or (c) propose adding the primitive to this exception registry

#### Scenario: Exception primitives carry a comment

- **WHEN** a file listed in the exception registry is opened
- **THEN** the file SHALL contain a top-of-file comment naming the exception status
- **AND** the comment SHALL point readers to this Requirement or the companion design decision

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

### Requirement: Reusable UI components own only generic component messages

Reusable components in `@rezics/ui` SHALL own translations only for generic component-internal text such as ARIA labels, button labels, placeholder text, empty states, and control labels that are intrinsic to the reusable component. `@rezics/ui` SHALL NOT own product, domain, feature, or contract-derived message text.

#### Scenario: Password field uses UI-owned messages

- **WHEN** a reusable password field component renders its visibility toggle
- **THEN** the show/hide accessible labels SHALL resolve from the `@rezics/ui` message catalog
- **AND** the component SHALL NOT import app/admin product message functions for those labels

#### Scenario: Domain label is excluded from UI catalog

- **WHEN** a component needs the display label for a content rating, attribution role, book type, or other Rezics domain concept
- **THEN** that label SHALL resolve from the product/domain i18n package or a domain adapter outside the portable UI component surface
- **AND** the reusable UI component SHALL NOT add that label to the `@rezics/ui` message catalog

### Requirement: UI package i18n follows host locale

`@rezics/ui` translated components SHALL render using the active locale supplied by the host shell. `@rezics/ui` SHALL expose a runtime helper or package export that lets the host synchronize the UI locale.

#### Scenario: Host synchronizes UI locale

- **WHEN** an app/admin shell changes the active locale to `ja`
- **THEN** the shell SHALL update the `@rezics/ui` i18n runtime to `ja`
- **AND** subsequently rendered UI-owned component text SHALL use Japanese messages

### Requirement: UI package does not use react-i18next

Reusable source files under `package/ui/src/` SHALL NOT import `react-i18next` or call `useTranslation()` after the Paraglide migration. UI-owned messages SHALL be accessed through generated Paraglide message functions.

#### Scenario: UI source imports are inspected

- **WHEN** imports under `package/ui/src/` are inspected
- **THEN** no reusable component source file SHALL import from `react-i18next`
- **AND** no reusable component source file SHALL call `useTranslation()`

### Requirement: UI package provides override escape hatches

Reusable UI components with built-in translated text SHALL allow consumers to override labels when the generic UI-owned copy is not appropriate for a specific product context.

#### Scenario: Consumer overrides UI label

- **WHEN** a consumer passes an explicit label or labels object to a reusable UI component
- **THEN** the component SHALL render the explicit consumer-provided text
- **AND** the component SHALL use its UI-owned Paraglide message only for omitted labels

### Requirement: shadcn barrel exports primitives only

The `@rezics/ui/shadcn` barrel SHALL expose the rezics-aligned shadcn primitive surface only. It SHALL NOT re-export dashboard demos, product sections, app-shell examples, or other composite examples that import Rezics product contracts or application-owned behavior.

Demo sections MAY remain available for Storybook or documentation through explicit non-core paths, but they SHALL NOT be part of the primary `@rezics/ui/shadcn` import surface.

#### Scenario: Consumer imports from shadcn barrel

- **WHEN** a consumer imports from `@rezics/ui/shadcn`
- **THEN** the imported barrel SHALL expose primitive components such as buttons, dialogs, inputs, tabs, and tables
- **AND** it SHALL NOT expose demo dashboard sections or app-shell examples

#### Scenario: Demo section imports product contract

- **WHEN** a shadcn demo section imports `@rezics/contract` or other product-specific helpers
- **THEN** that section SHALL live behind an explicit demo or documentation path
- **AND** it SHALL NOT be re-exported by `@rezics/ui/shadcn`

### Requirement: Base UI remains the shadcn primitive foundation

The shadcn-derived primitives under `@rezics/ui/shadcn` SHALL use Base UI as their interactive primitive foundation. New primitive work SHALL follow the Base UI based shadcn direction already established by the design system.

#### Scenario: New shadcn primitive is added

- **WHEN** a new shadcn-derived primitive is added under `package/ui/src/shadcn/`
- **THEN** it SHALL follow the Base UI based primitive direction
- **AND** consumers SHALL continue importing the rezics-aligned component through `@rezics/ui/shadcn` or its supported subpaths
