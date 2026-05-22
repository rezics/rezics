## ADDED Requirements

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
