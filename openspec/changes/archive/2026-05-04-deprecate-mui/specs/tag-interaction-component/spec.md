## ADDED Requirements

### Requirement: Popper is non-modal and does not block chip interaction

The popper SHALL use a non-modal popover primitive — shadcn `Popover` (from `@rezics/ui/shadcn`, Radix-based) configured with `modal={false}`. It SHALL NOT render a backdrop, lock scroll, or trap focus. Other tag chips SHALL remain clickable while the popper is open. The component SHALL NOT import from `@mui/material` (no `MUI Popper`, `MUI Popover`, or related primitive).

#### Scenario: Click another chip while popper is open

- **GIVEN** a popper is open for tag A
- **WHEN** the user clicks tag B
- **THEN** the click SHALL be received by tag B's click handler (not blocked by the popper)
- **AND** the popper for tag A SHALL close (driven by the `onOpenChange` of the Radix popover)
- **AND** the popper for tag B SHALL open

#### Scenario: No backdrop and no scroll lock

- **WHEN** a tag-interaction popper is open
- **THEN** the page SHALL remain scrollable and other elements SHALL remain clickable
- **AND** there SHALL be no element with `pointer-events: auto` covering the page beneath the popper

#### Scenario: No MUI imports in tag interaction

- **WHEN** the tag-interaction component file is inspected
- **THEN** there SHALL be no import from `@mui/material`
- **AND** the popover SHALL be sourced from `@rezics/ui/shadcn`
