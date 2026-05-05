## MODIFIED Requirements

### Requirement: Component selection policy is shadcn-or-custom

The rezics frontend SHALL select UI components from exactly two sources:

1. **shadcn primitives** wrapped under `@rezics/ui/shadcn` (Radix-based, token-aligned via the flat `--colors-*` CSS custom-property cascade emitted by UnoCSS preset-wind4 from `package/ui/src/config/uno-config.ts`) — the default choice when shadcn provides a primitive that fits the case.
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
