## ADDED Requirements

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
